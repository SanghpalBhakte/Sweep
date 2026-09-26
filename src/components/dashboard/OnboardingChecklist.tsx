'use client';

import React, { useState, useEffect } from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button, ButtonLink } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  X,
  Plus,
  UploadCloud,
  Bell,
  Globe,
  Check,
} from 'lucide-react';

const STORAGE_KEY = 'sweep_onboarding_dismissed_v1';
const LEGACY_STORAGE_KEY = 'sift_onboarding_dismissed_v1';

export function OnboardingChecklist() {
  const { subscriptions, profile, populateStarterTemplates } = useSubscriptions();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const stored =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored === 'true') {
        setIsDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  const handleReset = () => {
    setIsDismissed(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  if (!isMounted || isDismissed) {
    return null;
  }

  // Calculate task completion
  const hasSubscriptions = subscriptions.length > 0;
  const hasCustomReminders =
    Boolean(profile?.default_reminder_days && profile.default_reminder_days.length > 0);
  const hasCurrencyPreference = Boolean(profile?.currency_preference);
  const hasMultipleOrImported =
    subscriptions.length >= 3 || subscriptions.some((s) => s.notes?.includes('Imported'));

  const steps = [
    {
      id: 'first_sub',
      title: 'Track your first recurring subscription',
      description: 'Add a tool, streaming service, or free trial you want to keep an eye on.',
      isDone: hasSubscriptions,
      action: (
        <div className="flex items-center gap-2 mt-2">
          <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Subscription
          </ButtonLink>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => populateStarterTemplates()}
            className="gap-1 text-xs"
          >
            <Sparkles className="w-3 h-3 text-[hsl(var(--primary))]" />
            Load Sample Templates
          </Button>
        </div>
      ),
    },
    {
      id: 'import_statement',
      title: 'Import a bank or card statement',
      description: 'Upload a CSV or text PDF to detect recurring payments and trial services automatically.',
      isDone: hasMultipleOrImported,
      action: (
        <div className="mt-2">
          <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="gap-1.5 text-xs">
            <UploadCloud className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            Import Statement
          </ButtonLink>
        </div>
      ),
    },
    {
      id: 'reminder_settings',
      title: 'Configure renewal & trial alerts',
      description: 'Set advance notice days (e.g. 7, 3, or 1 day before charge) and test email delivery.',
      isDone: hasCustomReminders,
      action: (
        <div className="mt-2">
          <ButtonLink href="/settings" variant="outline" size="sm" className="gap-1.5 text-xs">
            <Bell className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            Alert Preferences
          </ButtonLink>
        </div>
      ),
    },
    {
      id: 'currency_settings',
      title: 'Set your primary display currency',
      description: `Subscriptions can be billed globally; choose your base reporting currency (Currently: ${profile?.currency_preference || 'USD'}).`,
      isDone: hasCurrencyPreference,
      action: (
        <div className="mt-2">
          <ButtonLink href="/settings" variant="outline" size="sm" className="gap-1.5 text-xs">
            <Globe className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            Workspace Settings
          </ButtonLink>
        </div>
      ),
    },
  ];

  const completedCount = steps.filter((s) => s.isDone).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllDone = completedCount === steps.length;

  return (
    <Card className="border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--card))] shadow-sm transition-all">
      <CardHeader className="pb-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
              <CardTitle className="text-sm sm:text-base font-bold">
                Getting Started with Sweep
              </CardTitle>
              <Badge variant={isAllDone ? 'success' : 'primary'} size="sm">
                {completedCount} of {steps.length} completed
              </Badge>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Complete these steps to set up a calm, automated recurring payments ledger.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss checklist"
            className="p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface))] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 w-full bg-[hsl(var(--surface-muted))] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[hsl(var(--primary))] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {isAllDone ? (
          <div className="p-3 text-xs bg-[hsl(var(--success-subtle))] border border-[hsl(var(--success)/0.3)] text-[hsl(var(--success))] rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>
                <strong>You&apos;re all set.</strong> Your subscriptions and reminders are ready to go.
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs text-[hsl(var(--success))]"
            >
              Hide
            </Button>
          </div>
        ) : null}

        <div className="divide-y divide-[hsl(var(--border))]">
          {steps.map((step) => (
            <div key={step.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
              <div className="pt-0.5 shrink-0">
                {step.isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                ) : (
                  <Circle className="w-4 h-4 text-[hsl(var(--muted-foreground)/0.6)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs font-semibold ${
                    step.isDone
                      ? 'line-through text-[hsl(var(--muted-foreground))]'
                      : 'text-[hsl(var(--foreground))]'
                  }`}
                >
                  {step.title}
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
                  {step.description}
                </p>
                {!step.isDone ? step.action : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
