// =============================================================================
// Sift - Browser Web Push Notification Client Service
// Path: src/lib/services/pushNotificationService.ts
// =============================================================================

import { createClient } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const STEP_TIMEOUT_MS = 20_000;

/** Rejects with `message` if the step takes longer than 20 seconds. */
export function withTimeout<T>(promise: Promise<T>, message: string, ms: number = STEP_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** True when an existing subscription was made with this VAPID public key. */
export function sameKey(existing: ArrayBuffer | null | undefined, key: Uint8Array): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

export class PushNotificationService {
  /**
   * Check if the browser supports Service Workers and Web Push
   */
  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get current browser notification permission
   */
  getPermissionState(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'default';
    }
    return Notification.permission;
  }

  /**
   * Register service worker if needed
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) return null;

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      return await withTimeout(
        navigator.serviceWorker.ready,
        'The app\'s background worker did not start in 20 seconds. Reload the page and try again.'
      );
    } catch (err) {
      console.warn('Could not register service worker:', err);
      return null;
    }
  }

  private async saveToServer(sub: PushSubscription): Promise<{ success: boolean; error?: string }> {
    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { success: false, error: 'Incomplete push subscription generated.' };
    }

    const token = await this.getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);
    try {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Failed to save subscription to server.' };
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.name === 'AbortError' ? 'Sweep did not answer in 20 seconds. Check your connection and try again.' : 'Could not reach Sweep. Check your connection and try again.',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * On app open: if this browser still has a subscription made with today's key,
   * send it to the server again (an upsert), in case the server dropped it.
   * Returns whether this device is really on.
   */
  async resync(vapidPublicKey?: string): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') return false;
    const key = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!sub || !sameKey(sub.options.applicationServerKey, urlBase64ToUint8Array(key))) return false;
      if (await this.getAuthToken()) await this.saveToServer(sub);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get existing browser push subscription if active
   */
  async getExistingSubscription(): Promise<PushSubscription | null> {
    if (!this.isSupported()) return null;

    try {
      const reg = await this.registerServiceWorker();
      if (!reg) return null;
      return await reg.pushManager.getSubscription();
    } catch (err) {
      console.warn('Error checking push subscription:', err);
      return null;
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const supabase = createClient();
      if (!supabase) return null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * Request native permission and subscribe to Web Push
   */
  async subscribe(vapidPublicKey?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'This browser can\'t show notifications.' };
    }

    // Note: The VAPID Public Key is intentionally public and client-facing, as mandated
    // by the W3C Push API specification for PushManager.subscribe({ applicationServerKey }).
    const key = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      return { success: false, error: 'Reminders are not set up on the server yet (VAPID key missing).' };
    }

    try {
      // 1. Ask first, straight from the tap. The key is already here (build-time env),
      // so nothing slow runs between "Allow" and subscribe, which iOS is strict about.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return {
          success: false,
          error:
            permission === 'denied'
              ? 'Notifications are blocked for Sweep. Allow them in your browser settings, then try again.'
              : 'You closed the permission popup. Tap the button again to allow it.',
        };
      }

      // 2. Obtain service worker registration
      const reg = await this.registerServiceWorker();
      if (!reg) {
        return { success: false, error: 'The app\'s background worker did not start. Reload the page and try again.' };
      }

      // 3. A browser keeps one subscription per worker. Reuse it if it was made with
      // this key; otherwise drop it, or subscribe() fails and pushes never arrive.
      const convertedVapidKey = urlBase64ToUint8Array(key);
      let subscription = await reg.pushManager.getSubscription();
      if (subscription && !sameKey(subscription.options.applicationServerKey, convertedVapidKey)) {
        const oldEndpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
        void this.removeFromServer(oldEndpoint);
      }
      if (!subscription) {
        subscription = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey as BufferSource,
          }),
          'Your device\'s push service did not answer in 20 seconds. Check your connection and try again.'
        );
      }

      // 4. Save to backend
      return await this.saveToServer(subscription);
    } catch (err: any) {
      console.error('Push subscription failed:', err);
      return { success: false, error: err.message || 'An unexpected error occurred during subscription.' };
    }
  }

  private async removeFromServer(endpoint: string): Promise<void> {
    const token = await this.getAuthToken();
    if (!token) return;
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined);
  }

  /**
   * Unsubscribe from browser push and remove from backend
   */
  async unsubscribe(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: true };
    }

    try {
      const reg = await this.registerServiceWorker();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();

          const token = await this.getAuthToken();
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          // Inform backend to remove subscription
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({ endpoint }),
          });
        }
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error unsubscribing from push:', err);
      return { success: false, error: err.message || 'Failed to unsubscribe.' };
    }
  }

  /**
   * Trigger an instant test push notification
   */
  async sendTestPush(): Promise<{ success: boolean; error?: string }> {
    try {
      const token = await this.getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const current = await this.getExistingSubscription();
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers,
        body: JSON.stringify({ endpoint: current?.endpoint }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to send test push notification.' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect to test endpoint.' };
    }
  }
}

export const pushNotificationService = new PushNotificationService();
