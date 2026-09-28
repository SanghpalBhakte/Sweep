'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { WelcomeScreen } from '@/components/dashboard/WelcomeScreen';
import { ButtonLink } from '@/components/ui/Button';
import { AnimatedCurrency } from '@/components/ui/AnimatedCurrency';
import { Subscription } from '@/lib/types';
import {
  convertCurrency,
  formatCurrency,
  formatCycle,
  normalizeMonthlyAmount,
} from '@/lib/utils/currency';
import { formatShortDate, getCountdownBadge, getDaysUntil } from '@/lib/utils/dates';
import { Plus, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const RestoreModal = dynamic(
  () => import('@/components/backup/RestoreModal').then((m) => m.RestoreModal),
  { ssr: false }
);

type GroupKey = 'overdue' | 'week' | 'month' | 'later';

const CYCLE_WORD: Record<string, string> = {
  monthly: 'monthly',
  quarterly: 'every 3 months',
  yearly: 'yearly',
};

// One ruled line at the bottom of the statement: label, dotted leader, value.
function TallyLine({
  label,
  children,
  muted = false,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline py-1.5">
      <span className="font-mono text-[13px]">{label}</span>
      <i aria-hidden="true" className="leader" />
      <span
        className={cn(
          'font-mono text-sm tabular-nums',
          muted ? 'text-muted-foreground' : 'font-semibold'
        )}
      >
        {children}
      </span>
    </div>
  );
}

// One subscription on the statement.
function StatementLine({ sub, group }: { sub: Subscription; group: GroupKey }) {
  const countdown = getCountdownBadge(sub.next_renewal_date);
  const cycle = sub.billing_cycle !== 'monthly' ? formatCycle(sub.billing_cycle, sub.custom_interval_days) : '';
  const dateText = formatShortDate(sub.next_renewal_date);

  const notes: string[] = [];
  if (group === 'overdue') notes.push(`Was due ${dateText}`);
  else if (group === 'week') notes.push(`${dateText} · ${countdown.label}`);
  else notes.push(dateText);
  if (sub.is_trial) notes.push('Free trial');
  notes.push(
    sub.billing_cycle === 'custom'
      ? `every ${sub.custom_interval_days || 30} days`
      : CYCLE_WORD[sub.billing_cycle] || 'recurring'
  );

  return (
    <Link
      href={`/subscriptions/${sub.id}/edit`}
      className={cn(
        'relative block min-h-[56px] py-2.5 hover:bg-foreground/[0.04] transition-colors',
        group === 'overdue' && 'pb-5'
      )}
    >
      <span className="flex items-baseline">
        <span className="font-serif text-[17px] leading-tight">{sub.name}</span>
        <i aria-hidden="true" className="leader" />
        <span className="relative font-mono text-[15px] font-semibold tabular-nums whitespace-nowrap">
          {formatCurrency(sub.amount, sub.currency)}
          {cycle ? (
            <span className="ml-1 text-xs font-normal text-muted-foreground">{cycle}</span>
          ) : null}
          {group === 'week' ? (
            <svg
              className="biro-circle"
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M14 8 C34 -1 86 0 95 14 C102 27 64 39 30 35 C6 32 -2 17 12 9 C20 5 31 3 42 3" />
            </svg>
          ) : null}
        </span>
      </span>
      <span className="mt-0.5 block font-mono text-xs text-muted-foreground pr-24">
        {notes.join(' · ')}
      </span>
      {group === 'overdue' ? (
        <span aria-hidden="true" className="stamp text-danger absolute right-1 bottom-1">
          Overdue
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardClient() {
  const { subscriptions, stats, displayCurrency, exchangeRates, isLoading } = useSubscriptions();

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const targetCurrency = stats.displayCurrency || displayCurrency || 'USD';

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === 'active'),
    [subscriptions]
  );

  // Next 7 days total (charges due today through a week from now)
  const next7 = useMemo(() => {
    const due = activeSubscriptions.filter((s) => {
      const days = getDaysUntil(s.next_renewal_date);
      return days >= 0 && days <= 7;
    });
    const total = due.reduce(
      (sum, s) =>
        sum + convertCurrency(s.amount, s.currency || 'USD', targetCurrency, exchangeRates.rates),
      0
    );
    return { count: due.length, total };
  }, [activeSubscriptions, targetCurrency, exchangeRates.rates]);

  // Statement sections, in date order: overdue, this week, later this month, later
  const groups = useMemo(() => {
    const sorted = [...activeSubscriptions].sort(
      (a, b) => new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime()
    );
    const buckets: Record<GroupKey, Subscription[]> = { overdue: [], week: [], month: [], later: [] };
    for (const sub of sorted) {
      const days = getDaysUntil(sub.next_renewal_date);
      if (days < 0) buckets.overdue.push(sub);
      else if (days <= 7) buckets.week.push(sub);
      else if (days <= 30) buckets.month.push(sub);
      else buckets.later.push(sub);
    }
    const titles: Record<GroupKey, string> = {
      overdue: 'Overdue',
      week: 'This week',
      month: 'Later this month',
      later: 'Later',
    };
    return (['overdue', 'week', 'month', 'later'] as GroupKey[])
      .filter((key) => buckets[key].length > 0)
      .map((key) => ({
        key,
        title: titles[key],
        items: buckets[key],
        total: buckets[key].reduce(
          (sum, s) =>
            sum + convertCurrency(s.amount, s.currency || 'USD', targetCurrency, exchangeRates.rates),
          0
        ),
      }));
  }, [activeSubscriptions, targetCurrency, exchangeRates.rates]);

  // Spend by category (desktop side panel)
  const categorySpend = useMemo(() => {
    if (stats.monthlyTotal === 0 || activeSubscriptions.length === 0) return [];
    const map: Record<string, { name: string; color: string; monthly: number }> = {};
    for (const sub of activeSubscriptions) {
      const id = sub.category_id || 'unassigned';
      const monthly = convertCurrency(
        sub.monthly_amount ||
          normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days),
        sub.currency || 'USD',
        targetCurrency,
        exchangeRates.rates
      );
      if (!map[id]) {
        map[id] = {
          name: sub.category?.name || 'Unassigned',
          color: sub.category?.color || 'hsl(var(--chart-5))',
          monthly: 0,
        };
      }
      map[id].monthly += monthly;
    }
    return Object.entries(map)
      .map(([id, d]) => ({
        id,
        ...d,
        percentage: Math.min(100, Math.round((d.monthly / stats.monthlyTotal) * 100)),
      }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5);
  }, [activeSubscriptions, stats.monthlyTotal, targetCurrency, exchangeRates.rates]);

  const heroValue = period === 'monthly' ? stats.monthlyTotal : stats.yearlyProjected;
  const now = new Date();

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
    <div className="animate-in fade-in duration-150">
      {/* Desktop actions (phones use the Add button in the top bar) */}
      <div className="hidden sm:flex items-center justify-end gap-2 mb-5">
        <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="gap-1.5">
          <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Import statement</span>
        </ButtonLink>
        <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1.5 px-3">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Add subscription</span>
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─── The statement ─────────────────────────────────────── */}
        <div className="paper-sheet lg:col-span-7">
          <section aria-label="Spending statement" className="paper px-5 sm:px-8 pt-10 pb-10">
            <header className="flex flex-col items-center gap-1 text-center">
              <h1 className="ink-label">Statement · {format(now, 'MMM yyyy')}</h1>
              <p className="font-mono text-xs text-muted-foreground">
                Printed {format(now, 'd MMM')} · {activeSubscriptions.length} subscription
                {activeSubscriptions.length === 1 ? '' : 's'}
              </p>
            </header>

            <div className="rule-dashed my-4" />

            <div className="text-center">
              <div
                role="group"
                aria-label="Show total per"
                className="flex items-center justify-center gap-1"
              >
                <span className="ink-label mr-1">You pay</span>
                {(['monthly', 'yearly'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={period === p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'relative inline-flex items-center min-h-[44px] px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] cursor-pointer transition-colors',
                      period === p ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p === 'monthly' ? 'Each month' : 'Each year'}
                    {period === p ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-2 right-2 bottom-2 h-[2px] bg-danger"
                      />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="text-foreground">
                {isLoading ? (
                  <div className="mx-auto my-2 h-[3.25rem] w-48 sweep-skeleton" aria-hidden="true" />
                ) : (
                  <AnimatedCurrency
                    value={heroValue}
                    currency={targetCurrency}
                    showCents={false}
                    className="font-serif text-[3.25rem] sm:text-[4.25rem] leading-none tracking-tight"
                  />
                )}
              </div>

              {!isLoading ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatCurrency(
                      period === 'monthly' ? stats.yearlyProjected : stats.monthlyTotal,
                      targetCurrency,
                      { showCents: false }
                    )}
                  </span>
                  {period === 'monthly' ? ' a year' : ' a month'}
                </p>
              ) : null}
            </div>

            <div className="rule-double mt-5 mb-2" />

            {isLoading ? (
              <div className="space-y-4 pt-3" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-4 w-40 sweep-skeleton" />
                    <div className="h-3 w-28 sweep-skeleton" />
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="py-6 text-center font-mono text-xs text-muted-foreground">
                No active subscriptions. Resume one or add a new one.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.key} aria-labelledby={`group-${group.key}`} className="mt-4">
                  <div className="flex items-baseline justify-between pt-2 pb-0.5">
                    <h2
                      id={`group-${group.key}`}
                      className={cn(
                        'font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
                        group.key === 'overdue' ? 'text-danger' : 'text-foreground'
                      )}
                    >
                      {group.title}
                    </h2>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatCurrency(group.total, targetCurrency, { showCents: false })}
                    </span>
                  </div>
                  {group.items.map((sub) => (
                    <StatementLine key={sub.id} sub={sub} group={group.key} />
                  ))}
                </section>
              ))
            )}

            {!isLoading ? (
              <>
                <div className="rule-single mt-6 mb-1" />
                <TallyLine label="Next 7 days" muted={next7.count === 0}>
                  {next7.count > 0 ? formatCurrency(next7.total, targetCurrency) : 'Nothing due'}
                </TallyLine>
                <TallyLine label="Next 30 days" muted={stats.upcoming30DaysTotal === 0}>
                  {formatCurrency(stats.upcoming30DaysTotal, targetCurrency)}
                </TallyLine>
                {stats.cancelCandidateCount > 0 ? (
                  <Link
                    href="/subscriptions"
                    className="flex items-baseline py-1.5 hover:bg-foreground/[0.04] transition-colors"
                  >
                    <span className="font-mono text-[13px]">Marked to cancel</span>
                    <i aria-hidden="true" className="leader" />
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {stats.cancelCandidateCount}
                    </span>
                  </Link>
                ) : null}
                <div className="rule-double mt-2" />
              </>
            ) : null}

            <Link
              href="/subscriptions/new"
              className="mt-6 flex min-h-[48px] items-center justify-center gap-2 border-[1.5px] border-dashed border-foreground font-mono text-[13px] font-semibold tracking-[0.04em] hover:bg-foreground/[0.05] transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add a subscription
            </Link>
            <Link
              href="/subscriptions/import"
              className="mt-1 flex min-h-[44px] items-center justify-center font-mono text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Import from a bank statement
            </Link>
          </section>
        </div>

        {/* ─── Desktop side note: where the money goes ────────────── */}
        <aside className="hidden lg:block lg:col-span-5">
          <div className="sweep-card p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-serif text-lg">Spend by category</h2>
              <Link
                href="/insights"
                className="font-mono text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground"
              >
                Insights
              </Link>
            </div>

            {categorySpend.length > 0 ? (
              <div className="space-y-3">
                {categorySpend.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="truncate pr-2">{cat.name}</span>
                      <span className="font-mono text-xs tabular-nums shrink-0">
                        <span className="text-muted-foreground">{cat.percentage}%</span>{' '}
                        <span className="font-semibold">
                          {formatCurrency(cat.monthly, targetCurrency, { showCents: false })}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-surface overflow-hidden" aria-hidden="true">
                      <div
                        className="h-full"
                        style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">No categories yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
