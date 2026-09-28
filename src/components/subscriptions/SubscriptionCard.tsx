'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { format, parseISO } from 'date-fns';
import { Subscription } from '@/lib/types';
import { useSubscriptions } from '@/context/SubscriptionContext';
import {
  formatCurrency,
  formatCycle,
  formatCycleFull,
  convertCurrency,
} from '@/lib/utils/currency';
import { getCountdownBadge, getDaysUntil, formatDate } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

const CancellationReviewModal = dynamic(
  () => import('./CancellationReviewModal').then((m) => m.CancellationReviewModal),
  { ssr: false }
);

const PriceHikeReviewModal = dynamic(
  () => import('./PriceHikeReviewModal').then((m) => m.PriceHikeReviewModal),
  { ssr: false }
);

interface SubscriptionCardProps {
  subscription: Subscription;
  onToggleStatus?: (id: string, currentStatus: string) => void;
  onDelete?: (id: string) => void;
}

const actionClass =
  'inline-flex items-center justify-center min-h-[44px] min-w-[44px] font-mono text-xs font-semibold uppercase tracking-[0.04em] underline underline-offset-[5px] decoration-[1.5px] cursor-pointer hover:opacity-70 transition-opacity';

/**
 * One line of the subscriptions ledger: due date in the margin, name and notes in the
 * middle, amount on the right. Tap the line to open Edit / Pause / Cancel.
 * Must sit inside a `.ledger-paper` (it reads --ledger-pad).
 */
export function SubscriptionCard({ subscription, onToggleStatus }: SubscriptionCardProps) {
  const { displayCurrency, exchangeRates } = useSubscriptions();
  const [open, setOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPriceHikeModalOpen, setIsPriceHikeModalOpen] = useState(false);
  const panelId = useId();

  const countdown = getCountdownBadge(subscription.next_renewal_date);
  const days = getDaysUntil(subscription.next_renewal_date);
  const isActive = subscription.status === 'active';
  const overdue = isActive && days < 0;

  const hasUnreviewedPriceHike =
    typeof subscription.previous_amount === 'number' &&
    subscription.previous_amount > 0 &&
    subscription.amount > subscription.previous_amount &&
    !subscription.price_hike_reviewed_at;

  const isDifferentCurrency = subscription.currency.toUpperCase() !== displayCurrency.toUpperCase();
  const convertedMonthly = isDifferentCurrency
    ? convertCurrency(
        subscription.monthly_amount,
        subscription.currency,
        displayCurrency,
        exchangeRates.rates
      )
    : null;

  const due = parseISO(subscription.next_renewal_date);
  const monthLabel =
    format(due, 'MMM') +
    (due.getFullYear() !== new Date().getFullYear() ? ` ’${format(due, 'yy')}` : '');

  const notes: { text: string; tone?: 'danger' | 'warning' }[] = [];
  if (subscription.status === 'canceled') notes.push({ text: 'Canceled' });
  else if (subscription.status === 'paused') notes.push({ text: 'Paused' });
  else if (overdue) notes.push({ text: countdown.label, tone: 'danger' });
  else if (countdown.urgent || countdown.warning) {
    notes.push({ text: countdown.label, tone: countdown.urgent ? 'danger' : 'warning' });
  }
  if (subscription.is_trial && isActive) notes.push({ text: 'Free trial' });
  if (hasUnreviewedPriceHike) notes.push({ text: 'Price went up', tone: 'warning' });
  if (subscription.value_rating === 'cancel_candidate' && isActive) {
    notes.push({ text: 'Marked to cancel' });
  }
  if (subscription.payment_method) {
    notes.push({
      text: `via ${subscription.payment_method.name}${
        subscription.payment_method.last4 ? ` ···${subscription.payment_method.last4}` : ''
      }`,
    });
  }

  return (
    <>
      <div
        className={cn(
          'border-b-[1.5px] border-dotted border-foreground/30',
          open && 'bg-foreground/[0.05]',
          subscription.status === 'paused' && 'opacity-70',
          subscription.status === 'canceled' && 'opacity-55'
        )}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center px-[var(--ledger-pad)] py-2.5 min-h-[64px] text-left cursor-pointer hover:bg-foreground/[0.03] transition-colors"
        >
          <span
            className={cn(
              'w-[52px] shrink-0 font-mono text-[11px] leading-[1.15] font-semibold uppercase tracking-[0.06em]',
              overdue ? 'text-danger' : 'text-muted-foreground'
            )}
          >
            {monthLabel}
            <b
              className={cn(
                'block text-[19px] tracking-normal font-semibold',
                overdue ? 'text-danger' : 'text-foreground'
              )}
            >
              {format(due, 'dd')}
            </b>
          </span>

          <span className="flex-1 min-w-0 pl-[30px]">
            <span className="block font-serif text-[17px] leading-tight truncate">
              {subscription.name}
            </span>
            <span className="block mt-0.5 font-mono text-xs text-muted-foreground">
              {notes.map((n, i) => (
                <React.Fragment key={n.text}>
                  {i > 0 ? ' · ' : null}
                  <span
                    className={cn(
                      n.tone === 'danger' && 'text-danger font-semibold',
                      n.tone === 'warning' && 'text-warning font-semibold'
                    )}
                  >
                    {n.text}
                  </span>
                </React.Fragment>
              ))}
            </span>
          </span>

          <span className="ml-2.5 text-right shrink-0">
            <span className="block font-mono text-[15px] font-semibold tabular-nums">
              {formatCurrency(subscription.amount, subscription.currency)}
            </span>
            <span className="block font-mono text-xs text-muted-foreground tabular-nums">
              {isDifferentCurrency && convertedMonthly !== null
                ? `≈ ${formatCurrency(convertedMonthly, displayCurrency)}/mo`
                : formatCycle(subscription.billing_cycle, subscription.custom_interval_days)}
            </span>
          </span>
        </button>

        {open ? (
          <div
            id={panelId}
            className="pl-[calc(var(--ledger-pad)+82px)] pr-[var(--ledger-pad)] pb-2"
          >
            <p className="font-mono text-xs text-muted-foreground">
              Renews {formatDate(subscription.next_renewal_date)} ·{' '}
              {formatCycleFull(subscription.billing_cycle, subscription.custom_interval_days)}
              {subscription.category ? ` · ${subscription.category.name}` : ''}
            </p>
            {subscription.description ? (
              <p className="mt-1 text-xs text-muted-foreground">{subscription.description}</p>
            ) : null}

            <div className="mt-0.5 flex flex-wrap items-center gap-x-4">
              <Link href={`/subscriptions/${subscription.id}/edit`} className={actionClass}>
                Edit
              </Link>

              {onToggleStatus && subscription.status !== 'canceled' ? (
                <button
                  type="button"
                  onClick={() => onToggleStatus(subscription.id, subscription.status)}
                  className={actionClass}
                >
                  {isActive ? 'Pause' : 'Resume'}
                </button>
              ) : null}

              {isActive ? (
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className={cn(actionClass, 'text-danger')}
                >
                  Cancel
                </button>
              ) : null}

              {hasUnreviewedPriceHike ? (
                <button
                  type="button"
                  onClick={() => setIsPriceHikeModalOpen(true)}
                  className={cn(actionClass, 'text-warning')}
                >
                  Review price
                </button>
              ) : null}

              {subscription.cancel_url ? (
                <a
                  href={subscription.cancel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={actionClass}
                >
                  Billing site ↗<span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {isCancelModalOpen && (
        <CancellationReviewModal
          subscription={subscription}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
        />
      )}

      {isPriceHikeModalOpen && (
        <PriceHikeReviewModal
          subscription={subscription}
          isOpen={isPriceHikeModalOpen}
          onClose={() => setIsPriceHikeModalOpen(false)}
          onOpenCancelModal={() => setIsCancelModalOpen(true)}
        />
      )}
    </>
  );
}
