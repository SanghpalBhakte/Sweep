'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { AppAlert, BrowserNotificationStatus, NotificationPreferences } from '../lib/types';
import { useSubscriptions } from './SubscriptionContext';
import {
  deriveAppAlerts,
  getDismissedAlerts,
  saveDismissedAlert,
} from '../lib/utils/reminders';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  dispatchLocalNotification,
} from '../lib/utils/notifications';
import { pushNotificationService } from '../lib/services/pushNotificationService';

interface NotificationContextType {
  alerts: AppAlert[];
  urgentAlertsCount: number;
  totalAlertsCount: number;
  permissionStatus: BrowserNotificationStatus;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  isAlertPanelOpen: boolean;
  preferences: NotificationPreferences;
  openAlertPanel: () => void;
  closeAlertPanel: () => void;
  toggleAlertPanel: () => void;
  dismissAlert: (id: string) => void;
  requestPermission: () => Promise<BrowserNotificationStatus>;
  enablePushNotifications: () => Promise<{ success: boolean; error?: string }>;
  disablePushNotifications: () => Promise<{ success: boolean; error?: string }>;
  sendTestPushNotification: () => Promise<{ success: boolean; error?: string }>;
  sendTestNotification: () => boolean;
  /** "Make sure reminders arrive" steps for this device */
  isReminderGuideOpen: boolean;
  openReminderGuide: () => void;
  closeReminderGuide: () => void;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { subscriptions, profile, updateProfile } = useSubscriptions();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<BrowserNotificationStatus>('unsupported');
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [isReminderGuideOpen, setIsReminderGuideOpen] = useState(false);

  // Initialize dismissed alerts and check browser push capabilities after idle
  useEffect(() => {
    setDismissedIds(getDismissedAlerts());
    setPermissionStatus(getBrowserNotificationPermission());

    const deferPushCheck = () => {
      const isSupported = pushNotificationService.isSupported();
      setIsPushSupported(isSupported);

      if (isSupported) {
        // Re-register this device with the server if it is still subscribed with
        // today's key; a subscription made with an old key counts as off.
        pushNotificationService.resync().then(setIsPushSubscribed);
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
        deferPushCheck
      );
    } else {
      setTimeout(deferPushCheck, 1000);
    }
  }, []);

  // Reminders go out at 9 AM in the timezone saved here. Only once the column exists
  // (signed-in profiles from the database have the key; guest profiles don't).
  useEffect(() => {
    if (!profile || !('timezone' in profile)) return;
    let deviceZone: string | undefined;
    try {
      deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (deviceZone && profile.timezone !== deviceZone) {
      updateProfile({ timezone: deviceZone }).catch(() => undefined);
    }
  }, [profile, updateProfile]);

  const preferences: NotificationPreferences = useMemo(() => {
    return {
      enabled: profile?.notifications_enabled !== false,
      notifyRenewals: profile?.notify_renewals !== false,
      notifyTrials: profile?.notify_trials !== false,
      offsets: profile?.default_reminder_days || [7, 3, 1],
    };
  }, [profile]);

  const alerts = useMemo(() => {
    if (!preferences.enabled) return [];
    return deriveAppAlerts(subscriptions, preferences, dismissedIds);
  }, [subscriptions, preferences, dismissedIds]);

  const urgentAlertsCount = useMemo(() => {
    return alerts.filter((a) => a.severity === 'urgent').length;
  }, [alerts]);

  const totalAlertsCount = alerts.length;

  const dismissAlert = useCallback((id: string) => {
    saveDismissedAlert(id);
    setDismissedIds((prev) => [...prev, id]);
  }, []);

  const handleRequestPermission = useCallback(async (): Promise<BrowserNotificationStatus> => {
    const res = await requestBrowserNotificationPermission();
    setPermissionStatus(res);
    return res;
  }, []);

  const enablePushNotifications = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const res = await pushNotificationService.subscribe();
    if (res.success) {
      setIsPushSubscribed(true);
      setPermissionStatus('granted');
      setIsReminderGuideOpen(true);
    } else {
      setPermissionStatus(getBrowserNotificationPermission());
    }
    return res;
  }, []);

  const disablePushNotifications = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const res = await pushNotificationService.unsubscribe();
    if (res.success) {
      setIsPushSubscribed(false);
    }
    return res;
  }, []);

  const sendTestPushNotification = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    return await pushNotificationService.sendTestPush();
  }, []);

  const handleSendTestNotification = useCallback((): boolean => {
    return dispatchLocalNotification('Sweep Reminder Test', {
      body: 'Your subscription renewal alerts are configured and active.',
    });
  }, []);

  const handleUpdatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      await updateProfile({
        notifications_enabled: updates.enabled !== undefined ? updates.enabled : preferences.enabled,
        notify_renewals:
          updates.notifyRenewals !== undefined ? updates.notifyRenewals : preferences.notifyRenewals,
        notify_trials:
          updates.notifyTrials !== undefined ? updates.notifyTrials : preferences.notifyTrials,
        default_reminder_days: updates.offsets || preferences.offsets,
      });
    },
    [preferences, updateProfile]
  );

  return (
    <NotificationContext.Provider
      value={{
        alerts,
        urgentAlertsCount,
        totalAlertsCount,
        permissionStatus,
        isPushSupported,
        isPushSubscribed,
        isAlertPanelOpen,
        preferences,
        openAlertPanel: () => setIsAlertPanelOpen(true),
        closeAlertPanel: () => setIsAlertPanelOpen(false),
        toggleAlertPanel: () => setIsAlertPanelOpen((prev) => !prev),
        dismissAlert,
        requestPermission: handleRequestPermission,
        enablePushNotifications,
        disablePushNotifications,
        sendTestPushNotification,
        sendTestNotification: handleSendTestNotification,
        isReminderGuideOpen,
        openReminderGuide: () => setIsReminderGuideOpen(true),
        closeReminderGuide: () => setIsReminderGuideOpen(false),
        updatePreferences: handleUpdatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
