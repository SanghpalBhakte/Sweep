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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[hsl(var(--border))]">
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Subscriptions
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subscriptions.length} tracked · You pay{' '}
              <span className="font-semibold text-[hsl(var(--foreground))]">
                {formatCurrency(stats.monthlyTotal, profile?.currency_preference || 'USD')}/mo
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="gap-1.5 text-xs">
              <UploadCloud className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              Import Statement
            </ButtonLink>

            <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1.5 shadow-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Subscription
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
