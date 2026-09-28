'use client';

import React from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { MetricCard } from '@/components/ui/MetricCard';
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
          <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
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
          <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
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

      {/* 1. Top-Level Stat Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Per month"
          value={<AnimatedCurrency value={stats.monthlyTotal} currency={currency} />}
          subtitle="All active subscriptions"
          trend={{
            text: `${stats.activeCount} active`,
            type: 'accent',
          }}
        />

        <MetricCard
          label="Per year"
          value={<AnimatedCurrency value={stats.yearlyProjected} currency={currency} />}
          subtitle="If nothing changes"
          trend={{
            text: '12 months',
            type: 'neutral',
          }}
        />

        <MetricCard
          label="Average cost"
          value={<AnimatedCurrency value={stats.averageMonthlySpend} currency={currency} />}
          subtitle="Per subscription, each month"
          trend={{
            text: 'Active ones only',
            type: 'neutral',
          }}
        />

        <MetricCard
          label="Due in 30 days"
          value={<AnimatedCurrency value={stats.upcoming30DaysTotal} currency={currency} />}
          subtitle={`${upcoming30Days.length} upcoming charges`}
          trend={{
            text: 'Coming up soon',
            type: upcoming30Days.some((u) => u.isUrgent) ? 'warning' : 'neutral',
          }}
        />
      </div>

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
