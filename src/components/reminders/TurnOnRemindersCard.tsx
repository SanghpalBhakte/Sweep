'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { showErrorToast } from '@/lib/toast/toast';

const SNOOZE_KEY = 'sweep_turn_on_reminders_snoozed_until';
const SNOOZE_DAYS = 14;

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) > Date.now();
  } catch {
    return false;
  }
}

/**
 * Asked at a moment of value (once there is something to be reminded about),
 * never on page load. False when it should not show.
 */
export function useShowTurnOnReminders(hasSubscriptions: boolean, signedIn: boolean): boolean {
  const { isPushSupported, isPushSubscribed, permissionStatus } = useNotifications();
  const [isSnoozed, setIsSnoozed] = useState(true);
  useEffect(() => setIsSnoozed(snoozed()), []);
  return signedIn && hasSubscriptions && isPushSupported && !isPushSubscribed && permissionStatus !== 'denied' && !isSnoozed;
}

export function TurnOnRemindersCard({ className }: { className?: string }) {
  const { enablePushNotifications } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const turnOn = async () => {
    setIsLoading(true);
    const res = await enablePushNotifications();
    setIsLoading(false);
    if (!res.success) showErrorToast(res.error || 'Could not turn on reminders.');
  };

  const notNow = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // storage blocked: hidden for this visit only
    }
    setHidden(true);
  };

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs', className)}>
      <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">Get a reminder before anything renews</p>
          <p className="text-muted-foreground leading-relaxed">
            Sweep can tell this device a few days before a renewal or a free trial ends, even with the app closed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="sm" onClick={turnOn} isLoading={isLoading}>
            Turn on reminders
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={notNow}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={notNow}
        aria-label="Hide for now"
        className="tap -m-2 shrink-0 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
