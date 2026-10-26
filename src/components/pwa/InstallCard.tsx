'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button, buttonClassName } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import {
  currentDevice,
  installCardMode,
  INSTALL_SNOOZE_DAYS,
  INSTALL_SNOOZE_KEY,
  type DeviceInfo,
} from '@/lib/utils/device';
import { promptInstall, useCanPromptInstall } from '@/lib/utils/installPrompt';
import { IOS_INSTALL_TIP } from './IosInstallTip';
import { showSuccessToast } from '@/lib/toast/toast';

const IN_APP_NAME = { instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp' } as const;

function readSnooze(): number | null {
  try {
    const v = Number(localStorage.getItem(INSTALL_SNOOZE_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Another dialog is open (onboarding, add subscription, the guide): wait for it. */
function modalOpen(): boolean {
  return Boolean(document.querySelector('[aria-modal="true"]'));
}

/**
 * Small, dismissable "install Sweep" card. Never blocks, never shows when the app
 * is already installed, and "Not now" hides it for 14 days on this device.
 */
export function InstallCard({ hasSubscriptions, className }: { hasSubscriptions: boolean; className?: string }) {
  const canPrompt = useCanPromptInstall();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(true);

  useEffect(() => {
    setDevice(currentDevice());
    setSnoozedUntil(readSnooze());
    const check = () => setBlocked(modalOpen());
    check();
    const timer = setInterval(check, 2000);
    return () => clearInterval(timer);
  }, []);

  if (!device) return null;
  const mode = installCardMode(device, {
    canPrompt,
    snoozedUntil,
    now: Date.now(),
    hasSubscriptions,
    modalOpen: blocked,
  });
  if (!mode) return null;

  const snooze = () => {
    const until = Date.now() + INSTALL_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    setSnoozedUntil(until);
    try {
      localStorage.setItem(INSTALL_SNOOZE_KEY, String(until));
    } catch {
      // storage blocked: hidden for this visit only
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showSuccessToast('Link copied. Paste it into Chrome or Safari.');
    } catch {
      // clipboard blocked: the URL is still in the address bar
    }
  };

  // Android in-app browsers can hand the page straight to Chrome
  const chromeIntent =
    device.platform === 'android'
      ? `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`
      : null;

  const title =
    mode === 'in-app' ? 'Open Sweep in your browser' : mode === 'ios' ? 'Get reminders on your iPhone' : 'Install Sweep';
  const text =
    mode === 'in-app'
      ? `${IN_APP_NAME[device.inApp!]}'s built-in browser can't install apps or send reminders. Open this page in ${device.platform === 'ios' ? 'Safari' : 'Chrome'}.`
      : mode === 'ios'
      ? IOS_INSTALL_TIP
      : mode === 'mac-safari'
      ? 'In Safari, choose File › Add to Dock. Open Sweep from the Dock, then turn on reminders in Settings.'
      : 'Reminders then come from Sweep, with its own icon, even when the browser is closed.';

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs', className)}>
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-muted-foreground leading-relaxed">{text}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === 'prompt' ? (
            <Button type="button" variant="primary" size="sm" onClick={() => void promptInstall()}>
              Install
            </Button>
          ) : null}
          {mode === 'in-app' && chromeIntent ? (
            <a href={chromeIntent} className={buttonClassName({ variant: 'primary', size: 'sm' })}>
              Open in Chrome
            </a>
          ) : null}
          {mode === 'in-app' ? (
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              Copy link
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={snooze}>
            Not now
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={snooze}
        aria-label="Hide for now"
        className="tap -m-2 shrink-0 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
