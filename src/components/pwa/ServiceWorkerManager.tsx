'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function ServiceWorkerManager() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return;
    setIsUpdating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let refreshing = false;

    // When the service worker updates and activates, reload once to load fresh bundles
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Register Service Worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // If a worker is already waiting (installed in background)
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowBanner(true);
        }

        // Listen for new service worker installation
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setShowBanner(true);
            }
          });
        });

        // Periodic background update check every 30 minutes
        const interval = setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Update check on app resume / tab focus
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      })
      .catch((err) => {
        console.warn('[SW Manager] Service worker registration error:', err);
      });
  }, []);

  if (!showBanner || !waitingWorker) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      aria-label="Application update available"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-4 fade-in duration-200"
    >
      <div className="sweep-card p-3.5 sm:p-4 bg-card/98 backdrop-blur-md border-primary/30 shadow-modal flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-foreground">Update available</h4>
            <p className="text-[11px] text-muted-foreground truncate">
              A newer version of Sweep is ready to load.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isUpdating}
            onClick={handleUpdate}
            className="text-xs font-semibold px-2.5 py-1 h-7 shadow-xs gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Update now</span>
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss update banner"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
