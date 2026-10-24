'use client';

import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const SEEN_KEY = 'sweep_ios_install_tip_seen';

/** iPhone or iPad, opened in the browser instead of from the home screen. */
export function isIosNotInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return !standalone;
}

const TIP = 'iPhone only sends notifications to apps on your home screen. In Safari, tap Share, then Add to Home Screen. Open Sweep from there and turn on phone notifications in Settings. Needs iOS 16.4 or newer.';

/**
 * Tells iPhone users how to get push reminders.
 * `once` shows a dismissible card that never comes back; otherwise a plain line.
 */
export function IosInstallTip({ once = false, className }: { once?: boolean; className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIosNotInstalled()) return;
    if (once) {
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
      } catch {
        // storage blocked: still show it
      }
    }
    setShow(true);
  }, [once]);

  if (!show) return null;

  if (!once) {
    return (
      <div className="py-3 space-y-1">
        <span className="text-xs font-medium text-foreground block">Phone notifications</span>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{TIP}</p>
      </div>
    );
  }

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs', className)}>
      <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-semibold text-foreground">Get reminders on your iPhone</p>
        <p className="text-muted-foreground leading-relaxed">{TIP}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Got it, hide this tip"
        className="tap -m-2 shrink-0 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
