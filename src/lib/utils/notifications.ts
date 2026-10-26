export type BrowserNotificationStatus = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Check the current browser notification permission status safely without prompting.
 */
export function getBrowserNotificationPermission(): BrowserNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as BrowserNotificationStatus;
}

/**
 * Soft opt-in request for browser notification permission.
 * MUST be invoked directly by user interaction (button click).
 */
export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as BrowserNotificationStatus;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

/**
 * Dispatch a calm local browser notification if permission is granted.
 */
export function dispatchLocalNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: unknown;
  }
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    new Notification(title, {
      body: options?.body || 'Upcoming subscription renewal reminder from Sweep.',
      icon: options?.icon || '/icons/icon-192.png',
      badge: options?.badge || '/icons/badge-96.png',
      tag: options?.tag || 'sweep-reminder',
      ...options,
    });
    return true;
  } catch (err) {
    console.warn('Failed to send browser notification:', err);
    return false;
  }
}
