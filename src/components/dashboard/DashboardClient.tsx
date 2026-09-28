'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { WelcomeScreen } from '@/components/dashboard/WelcomeScreen';
import { SubscriptionCard } from '@/components/subscriptions/SubscriptionCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { AnimatedCurrency } from '@/components/ui/AnimatedCurrency';
import { convertCurrency, formatCurrency, normalizeMonthlyAmount } from '@/lib/utils/currency';
import { formatDate, getCountdownBadge, getDaysUntil } from '@/lib/utils/dates';
import {
  ArrowRight,
  Plus,
  Sparkles,
  Calendar,
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

// One ruled line of the statement: label, dotted leader, value.
function LedgerLine({
  label,
  children,
  muted = false,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 py-2.5">
      <p className="text-sm text-muted-foreground shrink-0">{label}</p>
      <span
        aria-hidden="true"
        className="flex-1 border-b border-dotted border-[hsl(var(--chart-4)/0.45)] -translate-y-[3px]"
      />
      <p
        className={cn(
          'text-sm tabular-nums font-mono',
          muted ? 'text-muted-foreground' : 'text-foreground font-medium'
        )}
      >
        {children}
      </p>
    </div>
  );
}

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

  // Overdue renewals are the most urgent signal on the dashboard - fold them into
  // "Needs a look" so a lapsed renewal is never silently absent from every summary card.
  const needsLookCount = stats.overdueCount + stats.cancelCandidateCount + stats.trialCount;
  const attentionSummary = [
    stats.overdueCount > 0 ? `${stats.overdueCount} overdue` : null,
    stats.trialCount > 0 ? `${stats.trialCount} free trial${stats.trialCount > 1 ? 's' : ''}` : null,
    stats.cancelCandidateCount > 0 ? `${stats.cancelCandidateCount} marked to cancel` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const heroValue = period === 'monthly' ? stats.monthlyTotal : stats.yearlyProjected;

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
      {/* ─── 1. Page header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Overview
        </h1>

        <div className="hidden sm:flex items-center gap-2">
          <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="gap-1.5 text-xs">
            <UploadCloud className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>Import statement</span>
          </ButtonLink>

          <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1.5 shadow-xs px-3">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Subscription</span>
          </ButtonLink>
        </div>
      </div>

      {/* ─── 2. The statement: one hero figure, then ruled lines ─────── */}
      <section
        aria-label="Spending summary"
        className="ledger-margin rounded-xl bg-card border border-border/60 shadow-xs overflow-hidden"
      >
        <div className="px-5 pt-2 pb-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="sweep-editorial-label">You pay</span>
            <div role="group" aria-label="Show total per" className="flex items-center -mr-2">
              {(['monthly', 'yearly'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className="inline-flex items-center min-h-[44px] px-2 text-xs font-medium cursor-pointer"
                >
                  <span
                    className={cn(
                      'pb-0.5 border-b-2 transition-colors',
                      period === p
                        ? 'text-foreground border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                  >
                    {p === 'monthly' ? 'Monthly' : 'Yearly'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 text-foreground">
            <AnimatedCurrency
              value={heroValue}
              currency={targetCurrency}
              showCents={false}
              className="font-serif text-[2.75rem] sm:text-6xl font-semibold leading-none tracking-tight"
            />
            <span className="text-sm text-muted-foreground">
              {period === 'monthly' ? '/mo' : '/yr'}
            </span>
          </div>

          <p className="mt-2.5 text-sm text-muted-foreground">
            {formatCurrency(
              period === 'monthly' ? stats.yearlyProjected : stats.monthlyTotal,
              targetCurrency,
              { showCents: false }
            )}
            {period === 'monthly' ? ' a year' : ' a month'} · {activeSubscriptions.length}{' '}
            subscription{activeSubscriptions.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="border-t border-border/60 px-5 sm:px-6">
          <LedgerLine label="Next 7 days" muted={next7DaysRenewals.length === 0}>
            {next7DaysRenewals.length > 0
              ? `${formatCurrency(next7DaysTotal, targetCurrency)} (${next7DaysRenewals.length})`
              : 'Nothing due'}
          </LedgerLine>
          <LedgerLine label="Next 30 days" muted={stats.upcoming30DaysTotal === 0}>
            {formatCurrency(stats.upcoming30DaysTotal, targetCurrency)}
          </LedgerLine>
        </div>

        {nextRenewal ? (
          <div className="border-t border-border/60 px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Up next</p>
              <p className="mt-0.5 text-sm text-foreground truncate">
                <span className="font-semibold">{nextRenewal.name}</span>
                <span className="ml-2 font-mono tabular-nums">
                  {formatCurrency(nextRenewal.amount, nextRenewal.currency)}
                </span>
              </p>
            </div>
            {nextRenewalCountdown ? (
              <span
                className={cn(
                  'shrink-0 text-xs font-medium',
                  nextRenewalCountdown.urgent
                    ? 'stamp rounded-[3px] bg-danger/10 text-danger'
                    : 'text-muted-foreground'
                )}
              >
                {nextRenewalCountdown.label}
              </span>
            ) : null}
          </div>
        ) : null}

        {needsLookCount > 0 ? (
          <Link
            href="/subscriptions"
            className="border-t border-border/60 px-5 sm:px-6 py-3 flex items-center justify-between gap-3 hover:bg-surface/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Needs a look</p>
              <p className="mt-0.5 text-sm text-foreground truncate">{attentionSummary}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </Link>
        ) : null}
      </section>

      {/* ─── 3. Composed Two-Zone Workspace (7:5 Split) ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Primary Zone: Active Operational Ledger (7/12 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Section Header & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Subscriptions
              <span className="ml-2 font-sans text-sm font-normal text-muted-foreground tabular-nums">
                {filteredSubscriptions.length}
              </span>
            </h2>

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
          <div className="ledger-margin rounded-xl bg-card border border-border/60 shadow-xs divide-y divide-dotted divide-[hsl(var(--chart-4)/0.3)] overflow-hidden">
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
          <div className="ledger-margin rounded-xl bg-card border border-border/60 shadow-xs p-4 sm:p-5 space-y-5">
            {/* Section A: 30-Day Renewal Horizon */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
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
                  <h3 className="font-serif text-base font-semibold tracking-tight text-foreground">
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
