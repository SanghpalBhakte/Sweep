'use client';

import React from 'react';
import Link from 'next/link';
import { useNotifications } from '@/context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  Bell,
  BellRing,
  AlertTriangle,
  Clock,
  X,
  ExternalLink,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function AlertsSlideOver() {
  const {
    alerts,
    isAlertPanelOpen,
    closeAlertPanel,
    dismissAlert,
    permissionStatus,
    requestPermission,
  } = useNotifications();

  React.useEffect(() => {
    if (!isAlertPanelOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAlertPanel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAlertPanelOpen, closeAlertPanel]);

  if (!isAlertPanelOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Upcoming Alerts and Reminders">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200 transition-opacity"
        onClick={closeAlertPanel}
      />

      {/* Slide-Over Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 ease-out">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[hsl(var(--surface))] flex items-center justify-center text-[hsl(var(--primary))]">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">
                  Reminders
                </h2>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {alerts.length} coming up
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeAlertPanel}
              className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface))] transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Soft Opt-In Permission Card if not yet requested */}
            {permissionStatus === 'default' ? (
              <div className="p-3.5 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.04)] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--foreground))]">
                  <BellRing className="w-4 h-4 text-[hsl(var(--primary))]" />
                  <span>Get notified on this device</span>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                  Get a notification before a free trial ends or a subscription renews.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => requestPermission()}
                  className="w-full text-xs"
                >
                  Turn on notifications
                </Button>
              </div>
            ) : null}

            {alerts.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-[hsl(var(--surface))] flex items-center justify-center text-[hsl(var(--primary))]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    All caught up!
                  </h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs mx-auto">
                    No urgent renewals or expiring free trials in the next 7 days.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alerts.map((alert) => {
                  const isUrgent = alert.severity === 'urgent';
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'p-3.5 rounded-xl border transition-all space-y-2 relative',
                        isUrgent
                          ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-subtle))]'
                          : 'border-[hsl(var(--border))] bg-[hsl(var(--surface)/0.5)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'p-1 rounded-md shrink-0',
                              isUrgent
                                ? 'bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))]'
                                : 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                            )}
                          >
                            {isUrgent ? (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <span className="font-semibold text-xs text-[hsl(var(--foreground))]">
                            {alert.title}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => dismissAlert(alert.id)}
                          title="Dismiss"
                          className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {alert.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-[hsl(var(--border)/0.6)] text-xs">
                        <span className="font-semibold text-[hsl(var(--foreground))]">
                          {formatCurrency(alert.amount, alert.currency)}
                        </span>

                        <div className="flex items-center gap-2">
                          {alert.cancelUrl ? (
                            <a
                              href={alert.cancelUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1"
                            >
                              Cancel page <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : null}

                          <Link
                            href={`/subscriptions/${alert.subscriptionId}/edit`}
                            onClick={closeAlertPanel}
                            className="text-[11px] font-medium text-[hsl(var(--primary))] hover:underline"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3.5 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface)/0.3)] flex items-center justify-between text-xs">
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Change when you get reminded
            </span>
            <Link
              href="/settings"
              onClick={closeAlertPanel}
              className="text-[11px] font-medium text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
            >
              <Settings className="w-3 h-3" /> Reminder Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
