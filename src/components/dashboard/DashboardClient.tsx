'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import { InstallCard } from '@/components/pwa/InstallCard';
import { TurnOnRemindersCard, useShowTurnOnReminders } from '@/components/reminders/TurnOnRemindersCard';
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
import { Plus, UploadCloud, ChevronRight, CheckCircle2, WalletCards } from 'lucide-react';
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

// A card in the dashboard side column.
function SidePanel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sweep-card p-5" aria-label={title}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-lg leading-tight">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 w-full sweep-skeleton" />
      ))}
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
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
  const trialDays = getDaysUntil(sub.next_renewal_date);
  const trialUrgent = sub.is_trial && trialDays >= 0 && trialDays <= 7;
  if (sub.is_trial && !trialUrgent) notes.push('Free trial');
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
      <span className={cn('mt-0.5 block font-mono text-xs text-muted-foreground', group === 'overdue' ? 'pr-24' : 'pr-1')}>
        {notes.join(' · ')}
        {trialUrgent ? (
          <span className="block font-semibold text-danger">Trial ends {countdown.label.toLowerCase()}</span>
        ) : null}
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
  const { user } = useAuth();
  const showTurnOnReminders = useShowTurnOnReminders(subscriptions.length > 0, Boolean(user));

  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
      week: 'Coming up (next 7 days)',
      month: 'Later this month',
      later: 'Later',
    };
    return (['overdue', 'week', 'month', 'later'] as GroupKey[])
      // Coming up always shows, even when empty, so reminders are visible without push
      .filter((key) => buckets[key].length > 0 || (key === 'week' && sorted.length > 0))
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

  const overdueGroup = groups.find((g) => g.key === 'overdue');
  const weekGroup = groups.find((g) => g.key === 'week');
  const trialsEnding = activeSubscriptions.filter((s) => {
    const d = getDaysUntil(s.next_renewal_date);
    return s.is_trial && d >= 0 && d <= 7;
  }).length;

  // Each active subscription's cost per month, in the display currency
  const monthlyCosts = useMemo(
    () =>
      activeSubscriptions.map((sub) => ({
        sub,
        monthly: convertCurrency(
          sub.monthly_amount ||
            normalizeMonthlyAmount(sub.amount, sub.billing_cycle, sub.custom_interval_days),
          sub.currency || 'USD',
          targetCurrency,
          exchangeRates.rates
        ),
      })),
    [activeSubscriptions, targetCurrency, exchangeRates.rates]
  );

  const share = (monthly: number) =>
    stats.monthlyTotal > 0 ? Math.min(100, Math.round((monthly / stats.monthlyTotal) * 100)) : 0;

  // Side panels: spend by category, biggest costs, what pays for it, what needs a look
  const categorySpend = useMemo(() => {
    const map: Record<string, { name: string; color: string; monthly: number }> = {};
    for (const { sub, monthly } of monthlyCosts) {
      const id = sub.category_id || 'unassigned';
      map[id] ??= { name: sub.category?.name || 'Unassigned', color: '', monthly: 0 };
      map[id].monthly += monthly;
    }
    const sorted = Object.entries(map)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.monthly - a.monthly);
    const top =
      sorted.length <= 5
        ? sorted
        : [
            ...sorted.slice(0, 4),
            { id: 'other', name: 'Everything else', color: '', monthly: sorted.slice(4).reduce((sum, c) => sum + c.monthly, 0) },
          ];
    // Stored category colours are names ('moss', 'ochre') with no CSS behind them,
    // so colour by rank from the theme's chart palette instead.
    return top.map((c, i) => ({
      ...c,
      color: c.id === 'other' ? 'hsl(var(--muted-foreground))' : `hsl(var(--chart-${i + 1}))`,
    }));
  }, [monthlyCosts]);

  const biggestCosts = useMemo(
    () => [...monthlyCosts].sort((a, b) => b.monthly - a.monthly).slice(0, 4),
    [monthlyCosts]
  );

  const paymentSpend = useMemo(() => {
    const map: Record<string, { name: string; monthly: number; count: number }> = {};
    for (const { sub, monthly } of monthlyCosts) {
      if (!sub.payment_method) continue;
      const pm = sub.payment_method;
      map[pm.id] ??= { name: pm.last4 ? `${pm.name} ·· ${pm.last4}` : pm.name, monthly: 0, count: 0 };
      map[pm.id].monthly += monthly;
      map[pm.id].count += 1;
    }
    return Object.entries(map)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 4);
  }, [monthlyCosts]);

  const priceHikes = activeSubscriptions.filter(
    (s) => s.previous_amount != null && s.amount > s.previous_amount && !s.price_hike_reviewed_at
  ).length;

  const attention = [
    overdueGroup
      ? { key: 'overdue', tone: 'danger', text: `${overdueGroup.items.length} overdue payment${overdueGroup.items.length === 1 ? '' : 's'}`, href: '/subscriptions' }
      : null,
    trialsEnding > 0
      ? { key: 'trials', tone: 'danger', text: `${trialsEnding} free trial${trialsEnding === 1 ? '' : 's'} ending this week`, href: '/subscriptions' }
      : null,
    priceHikes > 0
      ? { key: 'hikes', tone: 'warning', text: `${priceHikes} price increase${priceHikes === 1 ? '' : 's'} to review`, href: '/insights' }
      : null,
    stats.cancelCandidateCount > 0
      ? { key: 'cancel', tone: 'muted', text: `${stats.cancelCandidateCount} marked to cancel`, href: '/insights' }
      : null,
  ].filter(Boolean) as { key: string; tone: 'danger' | 'warning' | 'muted'; text: string; href: string }[];

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
      {/* Page title + actions (phones use the Add button in the top bar) */}
      <div className="flex items-end justify-between gap-4 mb-6 max-sm:mb-0">
        <div className="max-sm:sr-only">
          <h1 className="font-serif text-2xl lg:text-[1.75rem] leading-tight tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(now, 'EEEE, d MMMM')}
            {!isLoading ? ` · ${activeSubscriptions.length} active` : ''}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <ButtonLink href="/subscriptions/import" variant="outline" size="sm" className="gap-1.5">
            <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Import statement</span>
          </ButtonLink>
          <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1.5 px-3">
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add subscription</span>
          </ButtonLink>
        </div>
      </div>

      {/* One card at a time: turn reminders on first, then install (iPhone needs install first) */}
      {showTurnOnReminders ? (
        <TurnOnRemindersCard className="mb-4 max-sm:mt-2" />
      ) : user ? (
        <InstallCard hasSubscriptions={subscriptions.length > 0} className="mb-4 max-sm:mt-2" />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        {/* ─── The statement ─────────────────────────────────────── */}
        <div className="paper-sheet lg:col-span-7">
          <section aria-label="Spending statement" className="paper px-5 sm:px-8 pt-10 pb-10">
            <header className="flex flex-col items-center gap-1 text-center">
              <h2 className="ink-label">Statement · {format(now, 'MMM yyyy')}</h2>
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

              {!isLoading ? (
                <p className="mt-4 inline-flex flex-wrap items-baseline justify-center gap-x-2 rounded-lg border border-foreground/15 px-3 py-2 font-mono">
                  <span className="text-[13px]">Due in the next 30 days:</span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(stats.upcoming30DaysTotal, targetCurrency, { showCents: false })}
                  </span>
                </p>
              ) : null}
            </div>

            {!isLoading && groups.length > 0 ? (
              <p className="mt-4 flex flex-wrap justify-center gap-x-2 text-center font-mono text-[13px] leading-snug">
                {overdueGroup ? (
                  <span className="whitespace-nowrap font-semibold text-danger">
                    {overdueGroup.items.length} overdue ({formatCurrency(overdueGroup.total, targetCurrency, { showCents: false })})
                  </span>
                ) : null}
                <span className="whitespace-nowrap">
                  {weekGroup
                    ? `${weekGroup.items.length} due this week (${formatCurrency(weekGroup.total, targetCurrency, { showCents: false })})`
                    : 'Nothing due this week'}
                </span>
                {trialsEnding > 0 ? (
                  <span className="whitespace-nowrap font-semibold text-danger">
                    {trialsEnding} free trial{trialsEnding === 1 ? '' : 's'} ending soon
                  </span>
                ) : null}
              </p>
            ) : null}

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
                  {(group.key !== 'overdue' && group.key !== 'week' && group.items.length > 4 && !expanded[group.key]
                    ? group.items.slice(0, 3)
                    : group.items
                  ).map((sub) => (
                    <StatementLine key={sub.id} sub={sub} group={group.key} />
                  ))}
                  {group.items.length === 0 ? (
                    <p className="py-2 font-mono text-xs text-muted-foreground">Nothing renews in the next 7 days.</p>
                  ) : null}
                  {group.key !== 'overdue' && group.key !== 'week' && group.items.length > 4 ? (
                    <button
                      type="button"
                      aria-expanded={!!expanded[group.key]}
                      onClick={() => setExpanded((e) => ({ ...e, [group.key]: !e[group.key] }))}
                      className="mt-1 flex min-h-[44px] w-full cursor-pointer items-center justify-center font-mono text-[13px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                    >
                      {expanded[group.key] ? 'Show fewer' : `Show ${group.items.length - 3} more`}
                    </button>
                  ) : null}
                </section>
              ))
            )}

            {!isLoading ? (
              <>
                <div className="rule-single mt-6 mb-1" />
                <TallyLine label="Next 7 days" muted={next7.count === 0}>
                  {next7.count > 0 ? formatCurrency(next7.total, targetCurrency) : 'Nothing due'}
                </TallyLine>
                {stats.cancelCandidateCount > 0 ? (
                  <Link
                    href="/subscriptions"
                    className="flex items-baseline py-3 hover:bg-foreground/[0.04] transition-colors"
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

        {/* ─── Side column: where the money goes ───────────────────── */}
        <aside className="hidden md:grid md:grid-cols-2 lg:grid-cols-1 gap-4 lg:col-span-5 lg:sticky lg:top-20 items-start">
          <SidePanel title="Spend by category" href="/insights" linkLabel="Insights">
            {isLoading ? (
              <PanelSkeleton rows={3} />
            ) : categorySpend.length > 0 ? (
              <>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface gap-px" aria-hidden="true">
                  {categorySpend.map((cat) => (
                    <div key={cat.id} style={{ width: `${share(cat.monthly)}%`, backgroundColor: cat.color }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {categorySpend.map((cat) => (
                    <li key={cat.id} className="flex items-center gap-2.5 text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} aria-hidden="true" />
                      <span className="truncate flex-1">{cat.name}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground w-9 text-right">{share(cat.monthly)}%</span>
                      <span className="font-mono text-xs tabular-nums font-semibold w-16 text-right">
                        {formatCurrency(cat.monthly, targetCurrency, { showCents: false })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <PanelEmpty>Add a subscription to see where your money goes.</PanelEmpty>
            )}
          </SidePanel>

          <SidePanel title="Needs a look">
            {isLoading ? (
              <PanelSkeleton rows={2} />
            ) : attention.length > 0 ? (
              <ul className="-my-1">
                {attention.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-2.5 min-h-[40px] text-sm hover:text-foreground transition-colors"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          item.tone === 'danger' ? 'bg-danger' : item.tone === 'warning' ? 'bg-warning' : 'bg-muted-foreground'
                        )}
                      />
                      <span className="flex-1">{item.text}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                All clear. Nothing overdue or ending soon.
              </p>
            )}
          </SidePanel>

          <SidePanel title="Biggest costs" href="/subscriptions" linkLabel="All">
            {isLoading ? (
              <PanelSkeleton rows={3} />
            ) : biggestCosts.length > 0 ? (
              <ol className="space-y-3">
                {biggestCosts.map(({ sub, monthly }, i) => (
                  <li key={sub.id}>
                    <Link href={`/subscriptions/${sub.id}/edit`} className="group block">
                      <span className="flex items-baseline gap-2.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-3">{i + 1}</span>
                        <span className="truncate flex-1 group-hover:underline underline-offset-4">{sub.name}</span>
                        <span className="font-mono text-xs tabular-nums font-semibold">
                          {formatCurrency(monthly, targetCurrency, { showCents: false })}
                          <span className="font-normal text-muted-foreground">/mo</span>
                        </span>
                      </span>
                      <span className="mt-1.5 ml-5.5 block h-1 rounded-full bg-surface overflow-hidden" aria-hidden="true">
                        <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${share(monthly)}%` }} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <PanelEmpty>No active subscriptions yet.</PanelEmpty>
            )}
          </SidePanel>

          {paymentSpend.length > 0 ? (
            <SidePanel title="Paid with" href="/settings" linkLabel="Manage">
              <ul className="space-y-2.5">
                {paymentSpend.map((pm) => (
                  <li key={pm.id} className="flex items-center gap-2.5 text-sm">
                    <WalletCards className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="truncate flex-1">{pm.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{pm.count}</span>
                    <span className="font-mono text-xs tabular-nums font-semibold w-16 text-right">
                      {formatCurrency(pm.monthly, targetCurrency, { showCents: false })}
                    </span>
                  </li>
                ))}
              </ul>
            </SidePanel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
