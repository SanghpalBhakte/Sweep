'use client';

import React from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

const SpendTrendChart = dynamic(
  () => import('@/components/insights/SpendTrendChart').then((m) => m.SpendTrendChart),
  {
    loading: () => <Skeleton className="h-48 w-full rounded-xl" />,
  }
);
const CategoryBreakdown = dynamic(
  () => import('@/components/insights/CategoryBreakdown').then((m) => m.CategoryBreakdown),
  {
    loading: () => <Skeleton className="h-44 w-full rounded-xl" />,
  }
);
const TopSubscriptions = dynamic(
  () => import('@/components/insights/TopSubscriptions').then((m) => m.TopSubscriptions),
  {
    loading: () => <Skeleton className="h-44 w-full rounded-xl" />,
  }
);
const UpcomingCashflowPressure = dynamic(
  () =>
    import('@/components/insights/UpcomingCashflowPressure').then(
      (m) => m.UpcomingCashflowPressure
    ),
  {
    loading: () => <Skeleton className="h-44 w-full rounded-xl" />,
  }
);
const ValueRatingAnalysis = dynamic(
  () =>
    import('@/components/insights/ValueRatingAnalysis').then(
      (m) => m.ValueRatingAnalysis
    ),
  {
    loading: () => <Skeleton className="h-44 w-full rounded-xl" />,
  }
);
const AnnualOptimizationReview = dynamic(
  () =>
    import('@/components/insights/AnnualOptimizationReview').then(
      (m) => m.AnnualOptimizationReview
    ),
  {
    loading: () => <Skeleton className="h-44 w-full rounded-xl" />,
  }
);
import { formatCurrency } from '@/lib/utils/currency';
import {
  calculateSpendTrend,
  calculateTopSubscriptions,
  calculateUpcoming30DayCharges,
} from '@/lib/utils/analytics';
import {
  getUpcomingAnnualRenewals,
  getAllAnnualSubscriptions,
} from '@/lib/utils/annualOptimization';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AnimatedCurrency } from '@/components/ui/AnimatedCurrency';
import { CurrencySwitcher } from '@/components/ui/CurrencySwitcher';
import {
  Lightbulb,
  Plus,
  Sparkles,
  Inbox,
} from 'lucide-react';

export default function InsightsPage() {
  const {
    subscriptions,
    categories,
    stats,
    exchangeRates,
    displayCurrency,
    isLoading,
    populateStarterTemplates,
  } = useSubscriptions();

  const currency = displayCurrency || 'USD';

  const trendData = calculateSpendTrend(subscriptions, 6, currency, exchangeRates.rates);
  const topSubscriptions = calculateTopSubscriptions(subscriptions, 5, currency, exchangeRates.rates);
  const upcoming30Days = calculateUpcoming30DayCharges(
    subscriptions,
    30,
    currency,
    exchangeRates.rates
  );

  // Annual renewals review window (nearing renewal or all active annual plans)
  const annualRenewals = getUpcomingAnnualRenewals(subscriptions, 60);
  const allAnnualPlans = getAllAnnualSubscriptions(subscriptions);
  const annualsToReview = annualRenewals.length > 0 ? annualRenewals : allAnnualPlans;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="pb-2 border-b border-border space-y-2">
          <div className="h-6 w-44 bg-surface-muted rounded-md animate-pulse" />
          <div className="h-3 w-64 bg-surface-muted rounded-md animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="sweep-card p-4 space-y-2"><div className="h-3 w-20 bg-surface-muted rounded animate-pulse" /><div className="h-6 w-24 bg-surface-muted rounded animate-pulse" /></div>
          <div className="sweep-card p-4 space-y-2"><div className="h-3 w-20 bg-surface-muted rounded animate-pulse" /><div className="h-6 w-24 bg-surface-muted rounded animate-pulse" /></div>
          <div className="sweep-card p-4 space-y-2"><div className="h-3 w-20 bg-surface-muted rounded animate-pulse" /><div className="h-6 w-24 bg-surface-muted rounded animate-pulse" /></div>
          <div className="sweep-card p-4 space-y-2"><div className="h-3 w-20 bg-surface-muted rounded animate-pulse" /><div className="h-6 w-24 bg-surface-muted rounded animate-pulse" /></div>
        </div>
        <div className="sweep-card p-6 space-y-4">
          <div className="h-4 w-40 bg-surface-muted rounded animate-pulse" />
          <div className="h-32 w-full bg-surface-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Clean empty state when user has 0 subscriptions
  if (subscriptions.length === 0) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-6">
        <div className="text-center space-y-1">
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
            Insights
          </h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Add a few subscriptions and you will see where your money goes each month and where you
            can save.
          </p>
        </div>

        <div className="sweep-card p-6 sm:p-8 text-center space-y-5 border-dashed">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-surface flex items-center justify-center text-primary">
            <Inbox className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">
              Nothing to show yet
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add your first subscription, or try Sweep with some sample data.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <ButtonLink href="/subscriptions/new" variant="primary" size="md" className="w-full sm:w-auto gap-1.5 shadow-xs">
              <Plus className="w-4 h-4" />
              Add a subscription
            </ButtonLink>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => populateStarterTemplates()}
              className="w-full sm:w-auto gap-1.5 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Try with sample data
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
            Insights
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where your money goes each month and where you can save
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CurrencySwitcher />
        </div>
      </div>

      {/* 1. Summary: one statement, not four boxes */}
      <section
        aria-label="Spending summary"
        className="ledger-margin rounded-xl bg-card border border-border/60 shadow-xs grid grid-cols-2 lg:grid-cols-4 overflow-hidden"
      >
        {[
          { label: 'Per month', value: stats.monthlyTotal, note: `${stats.activeCount} active` },
          { label: 'Per year', value: stats.yearlyProjected, note: 'if nothing changes' },
          { label: 'Average', value: stats.averageMonthlySpend, note: 'per subscription, monthly' },
          {
            label: 'Next 30 days',
            value: stats.upcoming30DaysTotal,
            note: `${upcoming30Days.length} charge${upcoming30Days.length === 1 ? '' : 's'}`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="p-4 sm:p-5 border-dotted border-[hsl(var(--chart-4)/0.35)] [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 lg:[&:not(:first-child)]:border-l"
          >
            <p className="sweep-editorial-label">{item.label}</p>
            <p className="mt-1.5 text-foreground">
              <AnimatedCurrency
                value={item.value}
                currency={currency}
                showCents={false}
                className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight"
              />
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </section>

      {/* 2. Calm Spend Trend Chart */}
      <section>
        <SpendTrendChart data={trendData} currency={currency} />
      </section>

      {/* 3. Annual Contract Optimization & Arbitrage Section */}
      {annualsToReview.length > 0 ? (
        <section>
          <AnnualOptimizationReview items={annualsToReview} currency={currency} />
        </section>
      ) : null}

      {/* 4. Category Breakdown & Top Cost Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <CategoryBreakdown
            subscriptions={subscriptions}
            categories={categories}
            currency={currency}
            rates={exchangeRates.rates}
          />
        </section>

        <section>
          <TopSubscriptions items={topSubscriptions} currency={currency} />
        </section>
      </div>

      {/* 5. Upcoming Payment Pressure & Utility Alignment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <UpcomingCashflowPressure
            items={upcoming30Days}
            total30Days={stats.upcoming30DaysTotal}
            currency={currency}
          />
        </section>

        <section>
          <ValueRatingAnalysis
            subscriptions={subscriptions}
            currency={currency}
            rates={exchangeRates.rates}
          />
        </section>
      </div>

      {/* 6. Sweep Financial Hygiene Recommendations */}
      <section>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <CardTitle>Quick tips</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <p>
                <strong className="text-foreground">Biggest costs:</strong> Your top{' '}
                {Math.min(topSubscriptions.length, 3)} subscriptions make up{' '}
                <strong className="text-foreground font-mono">
                  {topSubscriptions.slice(0, 3).reduce((acc, s) => acc + s.percentageOfTotal, 0)}%
                </strong>{' '}
                of what you spend each month.
              </p>
            </div>

            {stats.cancelCandidateCount > 0 ? (
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                <p>
                  <strong className="text-danger">Marked to cancel:</strong> You marked{' '}
                  {stats.cancelCandidateCount} subscription{stats.cancelCandidateCount === 1 ? '' : 's'} to cancel.
                  Cancelling {stats.cancelCandidateCount === 1 ? 'it' : 'them'} saves{' '}
                  <strong className="text-foreground font-mono">
                    {formatCurrency(stats.potentialMonthlySavings, currency)}/mo
                  </strong>{' '}
                  ({formatCurrency(stats.potentialMonthlySavings * 12, currency)}/year).
                </p>
              </div>
            ) : null}

            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <p>
                <strong className="text-foreground">Yearly plans:</strong> Paying yearly is often cheaper than paying monthly. Check the price before a yearly plan renews.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
