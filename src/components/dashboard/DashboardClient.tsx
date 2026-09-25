'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { WelcomeScreen } from '@/components/dashboard/WelcomeScreen';
import { SubscriptionCard } from '@/components/subscriptions/SubscriptionCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { convertCurrency, formatCurrency, normalizeMonthlyAmount } from '@/lib/utils/currency';
import { formatDate, getCountdownBadge, getDaysUntil } from '@/lib/utils/dates';
import {
  ArrowRight,
  Plus,
  Sparkles,
  Calendar,
  Receipt,
  Search,
  Layers,
  TrendingUp,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const RestoreModal = dynamic(
  () => import('@/components/backup/RestoreModal').then((m) => m.RestoreModal),
  { ssr: false }
);

export function DashboardClient() {
  const {
    subscriptions,
    categories,
    stats,
    displayCurrency,
    exchangeRates,
    isLoading,
    toggleStatus,
    deleteSubscription,
  } = useSubscriptions();

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const targetCurrency = stats.displayCurrency || displayCurrency || 'USD';

  // 1. Active subscriptions
  const activeSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => s.status === 'active');
  }, [subscriptions]);

  // 2. Upcoming Renewals in Next 7 Days
  const next7DaysRenewals = useMemo(() => {
    return activeSubscriptions.filter((s) => {
      const days = getDaysUntil(s.next_renewal_date);
      return days >= 0 && days <= 7;
    });
  }, [activeSubscriptions]);

  const next7DaysTotal = useMemo(() => {
    return next7DaysRenewals.reduce(
      (sum, s) =>
        sum + convertCurrency(s.amount, s.currency || 'USD', targetCurrency, exchangeRates.rates),
      0
    );
  }, [next7DaysRenewals, targetCurrency, exchangeRates.rates]);

  // 3. Chronological Upcoming 30 Days Renewals (Top 4)
  const upcomingChronological = useMemo(() => {
    return [...activeSubscriptions]
      .filter((s) => getDaysUntil(s.next_renewal_date) >= 0)
      .sort(
        (a, b) =>
          new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime()
      )
      .slice(0, 4);
  }, [activeSubscriptions]);

  // 4. Top Spend by Category Breakdown
  const categorySpendDistribution = useMemo(() => {
    if (stats.monthlyTotal === 0 || activeSubscriptions.length === 0) return [];
    const catMap: Record<string, { categoryName: string; color: string; monthlyAmount: number }> = {};
    for (const sub of activeSubscriptions) {
      const catId = sub.category_id || 'unassigned';
      const catName = sub.category?.name || 'Unassigned';
      const catColor = sub.category?.color || 'hsl(var(--primary))';
      const monthly = convertCurrency(
        sub.monthly_amount ||
          normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days),
        sub.currency || 'USD',
        targetCurrency,
        exchangeRates.rates
      );
      if (!catMap[catId]) {
        catMap[catId] = { categoryName: catName, color: catColor, monthlyAmount: 0 };
      }
      catMap[catId].monthlyAmount += monthly;
    }

    return Object.entries(catMap)
      .map(([id, data]) => ({
        categoryId: id,
        categoryName: data.categoryName,
        color: data.color,
        monthlyAmount: data.monthlyAmount,
        percentage: Math.min(100, Math.round((data.monthlyAmount / stats.monthlyTotal) * 100)),
      }))
      .sort((a, b) => b.monthlyAmount - a.monthlyAmount)
      .slice(0, 4);
  }, [activeSubscriptions, stats.monthlyTotal, targetCurrency, exchangeRates.rates]);

  // 5. Category filter pills
  const topCategories = useMemo(() => {
    const countMap: Record<string, number> = {};
    for (const sub of activeSubscriptions) {
      if (sub.category_id) {
        countMap[sub.category_id] = (countMap[sub.category_id] || 0) + 1;
      }
    }

    return categories
      .filter((c) => (countMap[c.id] || 0) > 0)
      .sort((a, b) => (countMap[b.id] || 0) - (countMap[a.id] || 0))
      .slice(0, 6);
  }, [categories, activeSubscriptions]);

  // 6. Filtered subscriptions for the dashboard ledger
  const filteredSubscriptions = useMemo(() => {
    let list = activeSubscriptions;
    if (selectedCategoryId !== 'all') {
      list = list.filter((s) => s.category_id === selectedCategoryId);
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.category?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeSubscriptions, selectedCategoryId, searchQuery]);

  const nextRenewal = stats.nextUpcomingRenewal;
  const nextRenewalCountdown = nextRenewal
    ? getCountdownBadge(nextRenewal.next_renewal_date)
    : null;

  // Zero-subscription state
  if (!isLoading && subscriptions.length === 0) {
    return (
      <>
        <WelcomeScreen onRestoreClick={() => setIsRestoreModalOpen(true)} />
        <RestoreModal
          isOpen={isRestoreModalOpen}
          onClose={() => setIsRestoreModalOpen(false)}
          onSuccess={() => setIsRestoreModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7 animate-in fade-in duration-150">
      {/* ─── 1. Top Workspace Command Header ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Overview
            </h1>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface text-muted-foreground border border-border/80">
              {activeSubscriptions.length} active
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            What you pay, what renews soon, and where your money goes.
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Period Toggle */}
          <div className="flex items-center gap-0.5 p-1 bg-surface border border-border/80 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setPeriod('monthly')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium text-xs transition-all cursor-pointer',
                period === 'monthly'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPeriod('yearly')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium text-xs transition-all cursor-pointer',
                period === 'yearly'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Yearly
            </button>
          </div>

          <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5 text-xs">
            <UploadCloud className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>Import statement</span>
          </ButtonLink>

          <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="hidden sm:inline-flex gap-1.5 shadow-xs px-3">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Subscription</span>
          </ButtonLink>
        </div>
      </div>

      {/* ─── 2. Unified Desk Summary Band (Single cohesive band, NOT 4 cards) ── */}
      <div className="rounded-xl bg-card border border-border/60 shadow-xs divide-y lg:divide-y-0 lg:divide-x divide-border/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Total Recurring Commitment */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {period === 'monthly' ? 'You pay per month' : 'You pay per year'}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-surface border border-border/40">
              {period === 'monthly' ? '/mo' : '/yr'}
            </span>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums font-mono">
              {formatCurrency(
                period === 'monthly' ? stats.monthlyTotal : stats.yearlyProjected,
                targetCurrency
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              For {activeSubscriptions.length} active subscription{activeSubscriptions.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
            <span>Per year</span>
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(stats.yearlyProjected, targetCurrency)}/yr
            </span>
          </div>
        </div>

        {/* Metric 2: 7-Day Renewal Window */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 opacity-60" />
              <span>Next 7 days</span>
            </span>
            {next7DaysRenewals.length > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.2 rounded-full bg-warning/12 text-warning">
                {next7DaysRenewals.length} due
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Nothing due</span>
            )}
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums font-mono">
              {next7DaysRenewals.length > 0 ? (
                formatCurrency(next7DaysTotal, targetCurrency)
              ) : (
                <span className="text-muted-foreground text-xl font-normal font-sans">None due</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {next7DaysRenewals.length > 0
                ? `${next7DaysRenewals.length} payment${next7DaysRenewals.length === 1 ? '' : 's'} this week`
                : 'No payments in the next 7 days'}
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
            <span>Next 30 days</span>
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(stats.upcoming30DaysTotal, targetCurrency)}
            </span>
          </div>
        </div>

        {/* Metric 3: Next Up Imminent Renewal */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 opacity-60" />
              <span>Next Renewal</span>
            </span>
            {nextRenewalCountdown && (
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.2 rounded-full',
                  nextRenewalCountdown.urgent
                    ? 'bg-danger/12 text-danger font-semibold'
                    : 'bg-surface text-muted-foreground'
                )}
              >
                {nextRenewalCountdown.label}
              </span>
            )}
          </div>

          {nextRenewal ? (
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-foreground truncate block">
                  {nextRenewal.name}
                </span>
                <span className="text-base font-mono font-bold text-foreground tabular-nums shrink-0">
                  {formatCurrency(nextRenewal.amount, nextRenewal.currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Due {formatDate(nextRenewal.next_renewal_date)}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-base font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nothing renews soon</p>
            </div>
          )}

          <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
            <span>Billed</span>
            <span className="capitalize">{nextRenewal?.billing_cycle || 'None'}</span>
          </div>
        </div>

        {/* Metric 4: Ledger Health & Optimization */}
        <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary opacity-80" />
              <span>Needs a look</span>
            </span>
            <Link
              href="/insights"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
            >
              <span>Insights</span>
              <ChevronRight className="w-2.5 h-2.5" />
            </Link>
          </div>

          <div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums font-mono flex items-baseline gap-2">
              <span>{stats.cancelCandidateCount + stats.trialCount}</span>
              <span className="text-xs font-normal text-muted-foreground font-sans">
                {stats.cancelCandidateCount + stats.trialCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.trialCount > 0
                ? `${stats.trialCount} free trial${stats.trialCount > 1 ? 's' : ''} running`
                : stats.cancelCandidateCount > 0
                ? 'Subscriptions you marked to cancel'
                : 'Nothing needs your attention'}
            </p>
          </div>

          <div className="pt-2 border-t border-border/40 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Marked to cancel</span>
            <span
              className={cn(
                'font-semibold font-mono',
                stats.cancelCandidateCount > 0 ? 'text-danger' : 'text-success'
              )}
            >
              {stats.cancelCandidateCount > 0 ? stats.cancelCandidateCount : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. Composed Two-Zone Workspace (7:5 Split) ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Zone: Active Operational Ledger (7/12 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Section Header & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Active Subscriptions
                </h2>
                <span className="text-xs font-mono font-medium px-2 py-0.2 rounded-md bg-surface text-muted-foreground border border-border/60">
                  {filteredSubscriptions.length}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Everything you are paying for right now.
              </p>
            </div>

            {/* Instant Filter Search */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sweep-input pl-8 pr-3 py-1 text-xs"
                aria-label="Filter active subscriptions"
              />
            </div>
          </div>

          {/* Category Filter Pills (Inline Strip) */}
          {activeSubscriptions.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0',
                  selectedCategoryId === 'all'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-surface/50 hover:bg-surface text-muted-foreground hover:text-foreground border border-border/40'
                )}
              >
                All ({activeSubscriptions.length})
              </button>

              {topCategories.map((category) => {
                const count = activeSubscriptions.filter(
                  (s) => s.category_id === category.id
                ).length;
                const isSelected = selectedCategoryId === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 flex items-center gap-1.5',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'bg-surface/50 hover:bg-surface text-muted-foreground hover:text-foreground border border-border/40'
                    )}
                  >
                    {category.color ? (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: isSelected ? 'currentColor' : category.color,
                        }}
                      />
                    ) : null}
                    <span>{category.name}</span>
                    {count > 0 ? (
                      <span
                        className={cn(
                          'text-[11px] tabular-nums font-mono',
                          isSelected ? 'opacity-80' : 'text-muted-foreground'
                        )}
                      >
                        ({count})
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Composed Ledger List (Single cohesive container with dividing lines) */}
          <div className="rounded-xl bg-card border border-border/60 shadow-xs divide-y divide-border/40 overflow-hidden">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-muted sweep-skeleton" />
                    <div className="space-y-1.5">
                      <div className="w-24 h-3.5 bg-surface-muted sweep-skeleton" />
                      <div className="w-36 h-2.5 bg-surface-muted sweep-skeleton" />
                    </div>
                  </div>
                  <div className="w-16 h-4 bg-surface-muted sweep-skeleton" />
                </div>
              ))
            ) : filteredSubscriptions.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-xs">
                <p className="text-muted-foreground">No subscriptions match your search or filter.</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCategoryId('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-primary cursor-pointer"
                >
                  Reset filters
                </Button>
              </div>
            ) : (
              filteredSubscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  subscription={sub}
                  onToggleStatus={toggleStatus}
                  onDelete={deleteSubscription}
                  compact={true}
                />
              ))
            )}

            {/* Footer summary row */}
            <div className="p-3 bg-surface/20 flex items-center justify-between text-xs px-4">
              <span className="text-muted-foreground">
                Showing {filteredSubscriptions.length} of {activeSubscriptions.length}
              </span>
              <Link
                href="/subscriptions"
                className="text-primary font-medium hover:underline flex items-center gap-1"
              >
                <span>See all subscriptions</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Support Zone: Unified Intelligence & Horizon Panel (5/12 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-card border border-border/60 shadow-xs p-4 sm:p-5 space-y-5">
            {/* Section A: 30-Day Renewal Horizon */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold tracking-tight text-foreground">
                    Coming up
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-mono text-muted-foreground">
                  Next 30 Days
                </span>
              </div>

              {upcomingChronological.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {upcomingChronological.map((sub) => {
                    const countdown = getCountdownBadge(sub.next_renewal_date);
                    return (
                      <Link
                        key={sub.id}
                        href={`/subscriptions/${sub.id}/edit`}
                        className="py-2.5 flex items-center justify-between gap-3 hover:bg-surface/50 px-2 rounded-lg transition-colors group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {sub.name}
                            </span>
                            {sub.is_trial ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-warning-subtle text-warning border border-warning/30">
                                Trial
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDate(sub.next_renewal_date)}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold font-mono text-foreground tabular-nums">
                            {formatCurrency(sub.amount, sub.currency)}
                          </div>
                          <span
                            className={cn(
                              'text-[10px] block mt-0.5',
                              countdown.urgent ? 'text-danger font-bold' : 'text-muted-foreground'
                            )}
                          >
                            {countdown.label}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No renewals in the next 30 days.
                </div>
              )}

              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Total for next 30 days</span>
                <span className="font-mono font-bold text-foreground">
                  {formatCurrency(stats.upcoming30DaysTotal, targetCurrency)}
                </span>
              </div>
            </div>

            {/* Section B: Category Spend Distribution (Divided quietly, not separate box) */}
            <div className="pt-4 border-t border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold tracking-tight text-foreground">
                    Spend by Category
                  </h3>
                </div>
                <Link
                  href="/insights"
                  className="text-[10px] text-primary hover:underline font-medium"
                >
                  Insights
                </Link>
              </div>

              {categorySpendDistribution.length > 0 ? (
                <div className="space-y-2.5">
                  {categorySpendDistribution.map((cat) => (
                    <div key={cat.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground truncate pr-2">
                          {cat.categoryName}
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums shrink-0">
                          <span className="text-muted-foreground">{cat.percentage}%</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(cat.monthlyAmount, targetCurrency)}/mo
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: cat.color || 'hsl(var(--primary))',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No categories yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
