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
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;
      return reg;
    } catch (err) {
      console.warn('Could not register service worker:', err);
      return null;
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
      // 1. Request native permission from explicit user interaction
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
        return { success: false, error: 'Could not initialize service worker.' };
      }

      // 3. Subscribe with PushManager
      const convertedVapidKey = urlBase64ToUint8Array(key);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as BufferSource,
      });

      const subJson = subscription.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        return { success: false, error: 'Incomplete push subscription generated.' };
      }

      const token = await this.getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 4. Save to backend
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to save subscription to server.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Push subscription failed:', err);
      return { success: false, error: err.message || 'An unexpected error occurred during subscription.' };
    }
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
