'use client';

import React from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { SubscriptionList } from '@/components/subscriptions/SubscriptionList';
import { ButtonLink } from '@/components/ui/Button';
import { Plus, UploadCloud } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { AppErrorBoundary } from '@/lib/errors/AppErrorBoundary';
import { SubscriptionScreenErrorFallback } from '@/lib/errors/SubscriptionScreenErrorFallback';

export default function SubscriptionsPage() {
  const { subscriptions, stats, profile, isLoading, toggleStatus, deleteSubscription } =
    useSubscriptions();

  return (
    <AppErrorBoundary fallback={<SubscriptionScreenErrorFallback title="Unable to render Subscriptions Ledger" />}>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header (phones use the Add button in the top bar) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
              Subscriptions
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1.5">
              {subscriptions.length} tracked · you pay{' '}
              <span className="font-semibold text-foreground">
                {formatCurrency(stats.monthlyTotal, profile?.currency_preference || 'USD', { showCents: false })} a month
              </span>
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="gap-1.5">
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
              Import statement
            </ButtonLink>

            <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add subscription
            </ButtonLink>
          </div>
        </div>

        {/* Subscription List with full interactive filters */}
        <SubscriptionList
          subscriptions={subscriptions}
          isLoading={isLoading}
          onToggleStatus={toggleStatus}
          onDelete={deleteSubscription}
        />
      </div>
    </AppErrorBoundary>
  );
}
