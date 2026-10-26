'use client';

import React, { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/Button';
import { Portal } from '@/components/ui/Portal';
import { currentDevice, reminderGuide, type DeviceInfo } from '@/lib/utils/device';
import { formatReminderHour } from '@/lib/utils/pushReminders';
import { promptInstall, useCanPromptInstall } from '@/lib/utils/installPrompt';
import { showErrorToast, showSuccessToast } from '@/lib/toast/toast';

/**
 * "Make sure reminders arrive": plain steps for this device. Opens right after
 * reminders are turned on, and again from Settings.
 */
export function ReminderGuide() {
  const { isReminderGuideOpen, closeReminderGuide, sendTestPushNotification } = useNotifications();
  const canPromptInstall = useCanPromptInstall();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isReminderGuideOpen) setDevice(currentDevice());
  }, [isReminderGuideOpen]);

  useEffect(() => {
    if (!isReminderGuideOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeReminderGuide();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isReminderGuideOpen, closeReminderGuide]);

  if (!isReminderGuideOpen || !device) return null;
  const guide = reminderGuide(device);

  const handleTest = async () => {
    setIsTesting(true);
    const res = await sendTestPushNotification();
    setIsTesting(false);
    if (res.success) showSuccessToast('Test sent. It should show up in a few seconds.');
    else showErrorToast(res.error || 'Could not send the test.');
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-guide-title"
        onClick={closeReminderGuide}
      >
        <div
          className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 border-b border-border flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <BellRing className="w-4 h-4 mt-0.5 text-primary shrink-0" aria-hidden="true" />
              <div>
                <h2 id="reminder-guide-title" className="text-base font-bold text-foreground">
                  Make sure reminders arrive
                </h2>
                <p className="text-xs text-muted-foreground">
                  {guide.heading}. Reminders come at about {formatReminderHour()} your time.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeReminderGuide}
              aria-label="Close"
              className="tap -m-2 p-2 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <ol className="p-5 space-y-3 list-decimal list-inside text-xs text-foreground leading-relaxed">
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="px-5 pb-5 flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={handleTest} isLoading={isTesting}>
              Send a test
            </Button>
            {guide.suggestInstall && canPromptInstall ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void promptInstall()}>
                Install Sweep
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={closeReminderGuide}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
