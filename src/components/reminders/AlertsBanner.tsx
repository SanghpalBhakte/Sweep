'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useNotifications } from '@/context/NotificationContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatCurrency } from '@/lib/utils/currency';
import { Bell, AlertTriangle, Clock, X, ExternalLink, ArrowRight, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function AlertsBanner() {
  const {
    alerts,
    isPushSupported,
    isPushSubscribed,
    enablePushNotifications,
    dismissAlert,
    openAlertPanel,
  } = useNotifications();

  const [isSoftPromptDismissed, setIsSoftPromptDismissed] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  if (alerts.length === 0) return null;

  // Show top 2 most urgent alerts on dashboard banner
  const displayedAlerts = alerts.slice(0, 2);

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      await enablePushNotifications();
    } finally {
      setIsEnablingPush(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--foreground))]">
          <Bell className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
          <span>Attention Needed ({alerts.length})</span>
        </div>
        {alerts.length > 2 ? (
          <button
            type="button"
            onClick={openAlertPanel}
            className="text-[11px] text-[hsl(var(--primary))] hover:underline flex items-center gap-0.5"
          >
            View all {alerts.length} <ArrowRight className="w-3 h-3" />
          </button>
        ) : null}
      </div>

      {/* Soft Push Opt-in Prompt */}
      {isPushSupported && !isPushSubscribed && !isSoftPromptDismissed ? (
        <div className="p-3 rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.05)] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
            <span className="text-[hsl(var(--foreground))] truncate">
              Get quiet browser push alerts before subscriptions renew
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleEnablePush}
              isLoading={isEnablingPush}
              className="text-xs h-7 px-2.5 shadow-xs"
            >
              Enable Push
            </Button>
            <button
              type="button"
              onClick={() => setIsSoftPromptDismissed(true)}
              className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              title="Not now"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {displayedAlerts.map((alert) => {
          const isUrgent = alert.severity === 'urgent';
          return (
            <div
              key={alert.id}
              className={cn(
                'p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 shadow-xs',
                isUrgent
                  ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger-subtle))]'
                  : 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-subtle))]'
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className={cn(
                    'p-1.5 rounded-lg shrink-0 mt-0.5',
                    isUrgent
                      ? 'bg-[hsl(var(--danger)/0.15)] text-[hsl(var(--danger))]'
                      : 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]'
                  )}
                >
                  {isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-[hsl(var(--foreground))]">
                      {alert.title}
                    </span>

                    <Badge variant={isUrgent ? 'danger' : 'warning'} size="sm">
                      {alert.daysUntil === 0
                        ? 'Today'
                        : alert.daysUntil === 1
                        ? 'Tomorrow'
                        : alert.daysUntil < 0
                        ? `${Math.abs(alert.daysUntil)}d overdue`
                        : `In ${alert.daysUntil} days`}
                    </Badge>
                  </div>

                  <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                    <span className="font-semibold text-[hsl(var(--foreground))]">
                      {formatCurrency(alert.amount, alert.currency)}
                    </span>
                    <Link
                      href={`/subscriptions/${alert.subscriptionId}/edit`}
                      className="max-md:py-3 max-md:-my-3 text-[hsl(var(--primary))] hover:underline flex items-center gap-1 font-medium"
                    >
                      Manage subscription <ArrowRight className="w-3 h-3" />
                    </Link>
                    {alert.cancelUrl ? (
                      <a
                        href={alert.cancelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1"
                      >
                        Cancel link <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Dismiss Action */}
              <button
                type="button"
                onClick={() => dismissAlert(alert.id)}
                title="Dismiss this alert"
                className="p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface))] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
