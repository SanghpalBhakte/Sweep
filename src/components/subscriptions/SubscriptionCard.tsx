'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Subscription } from '@/lib/types';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { ValueRatingTag } from '../ui/ValueRatingTag';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatCycle, convertCurrency } from '@/lib/utils/currency';
import { getCountdownBadge, formatDate } from '@/lib/utils/dates';

const CancellationReviewModal = dynamic(
  () =>
    import('./CancellationReviewModal').then((m) => m.CancellationReviewModal),
  { ssr: false }
);

const PriceHikeReviewModal = dynamic(
  () =>
    import('./PriceHikeReviewModal').then((m) => m.PriceHikeReviewModal),
  { ssr: false }
);
import {
  ExternalLink,
  Pause,
  Play,
  Calendar,
  Edit3,
  Scissors,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SubscriptionCardProps {
  subscription: Subscription;
  onToggleStatus?: (id: string, currentStatus: string) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function SubscriptionCard({
  subscription,
  onToggleStatus,
  compact = false,
}: SubscriptionCardProps) {
  const { displayCurrency, exchangeRates } = useSubscriptions();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPriceHikeModalOpen, setIsPriceHikeModalOpen] = useState(false);

  const countdown = getCountdownBadge(subscription.next_renewal_date);
  const trialCountdown = subscription.trial_end_date
    ? getCountdownBadge(subscription.trial_end_date)
    : null;

  const hasUnreviewedPriceHike =
    typeof subscription.previous_amount === 'number' &&
    subscription.previous_amount > 0 &&
    subscription.amount > subscription.previous_amount &&
    !subscription.price_hike_reviewed_at;

  const isDifferentCurrency =
    subscription.currency.toUpperCase() !== displayCurrency.toUpperCase();

  const convertedMonthly = isDifferentCurrency
    ? convertCurrency(
        subscription.monthly_amount,
        subscription.currency,
        displayCurrency,
        exchangeRates.rates
      )
    : null;

  // Streamlined Compact Ledger Row (for table-led dashboard scanning)
  if (compact) {
    return (
      <Link
        href={`/subscriptions/${subscription.id}/edit`}
        className={cn(
          'px-3.5 py-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-surface/50 transition-colors group cursor-pointer',
          subscription.status === 'paused' && 'opacity-60 bg-surface/20',
          subscription.status === 'canceled' && 'opacity-50'
        )}
      >
        {/* Left: Icon Badge & Name & Next Billing Date */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-hover:scale-105 border border-border/40 shadow-2xs"
            style={{
              backgroundColor: subscription.category?.color
                ? `${subscription.category.color}15`
                : 'hsl(var(--surface))',
              color: subscription.category?.color || 'hsl(var(--primary))',
            }}
          >
            {subscription.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate block">
                {subscription.name}
              </span>
              {subscription.is_trial ? (
                <span className="inline-block px-1.5 py-0.2 bg-warning/12 text-warning rounded text-[10px] font-medium shrink-0">
                  Trial
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <span className="truncate">
                {formatDate(subscription.next_renewal_date)}
              </span>
              {subscription.category ? (
                <span className="truncate hidden sm:inline">
                  <span className="opacity-40 mr-1.5" aria-hidden="true">·</span>
                  {subscription.category.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right: Cost & Cycle */}
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold font-mono tracking-tight text-foreground tabular-nums">
            {formatCurrency(subscription.amount, subscription.currency)}
            <span className="text-xs font-normal font-sans text-muted-foreground ml-1">
              {formatCycle(subscription.billing_cycle, subscription.custom_interval_days)}
            </span>
          </div>

          {countdown.urgent || countdown.warning ? (
            <span
              className={cn(
                'text-[11px] font-medium block mt-0.5',
                countdown.urgent ? 'text-danger font-semibold' : 'text-warning'
              )}
            >
              {countdown.label}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground block mt-0.5 capitalize">
              {subscription.status}
            </span>
          )}
        </div>
      </Link>
    );
  }

  // Full Management Card (for /subscriptions list)
  return (
    <>
      <div
        className={cn(
          'sweep-card p-3.5 sm:p-4 transition-all',
          subscription.status === 'paused' && 'opacity-60',
          subscription.status === 'canceled' && 'opacity-50 border-dashed'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left: Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/subscriptions/${subscription.id}/edit`}
                className="text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors truncate"
              >
                {subscription.name}
              </Link>

              {subscription.status === 'paused' ? (
                <Badge variant="muted" size="sm">Paused</Badge>
              ) : subscription.status === 'canceled' ? (
                <Badge variant="danger" size="sm">Canceled in Sweep</Badge>
              ) : null}

              {subscription.is_trial ? (
                <Badge variant="warning" size="sm">
                  Trial {trialCountdown ? `· ${trialCountdown.label}` : ''}
                </Badge>
              ) : null}

              {hasUnreviewedPriceHike ? (
                <button
                  type="button"
                  onClick={() => setIsPriceHikeModalOpen(true)}
                  className="cursor-pointer"
                >
                  <Badge variant="warning" size="sm" className="gap-1 hover:opacity-85 transition-opacity">
                    <TrendingUp className="w-3 h-3" /> Price Increased · Review
                  </Badge>
                </button>
              ) : null}

              <ValueRatingTag rating={subscription.value_rating} size="sm" />
            </div>

            {subscription.description ? (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {subscription.description}
              </p>
            ) : null}

            {/* Metadata chips */}
            <div className="flex items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 opacity-60" aria-hidden="true" />
                Renews {formatDate(subscription.next_renewal_date)}
              </span>

              {subscription.category ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                  {subscription.category.name}
                </span>
              ) : null}

              {subscription.payment_method ? (
                <span>
                  via {subscription.payment_method.name}
                  {subscription.payment_method.last4 ? ` (···· ${subscription.payment_method.last4})` : ''}
                </span>
              ) : null}
            </div>
          </div>

          {/* Right: Financials & Status */}
          <div className="flex flex-col items-end gap-1 shrink-0 text-right">
            <div>
              <div className="text-base sm:text-lg font-semibold tracking-tight text-foreground tabular-nums">
                {formatCurrency(subscription.amount, subscription.currency)}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">
                  {formatCycle(subscription.billing_cycle, subscription.custom_interval_days)}
                </span>
              </div>

              {isDifferentCurrency && convertedMonthly !== null ? (
                <div className="text-[11px] text-primary font-medium tabular-nums">
                  ≈ {formatCurrency(convertedMonthly, displayCurrency)}/mo
                </div>
              ) : subscription.billing_cycle !== 'monthly' ? (
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  ~{formatCurrency(subscription.monthly_amount, subscription.currency)}/mo
                </div>
              ) : null}
            </div>

            {subscription.status === 'active' && !subscription.is_trial ? (
              <Badge
                variant={
                  countdown.urgent ? 'danger' : countdown.warning ? 'warning' : 'outline'
                }
                size="sm"
              >
                {countdown.label}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Card Footer */}
        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {subscription.cancel_url ? (
              <a
                href={subscription.cancel_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                Billing site
              </a>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            {subscription.status === 'active' ? (
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-danger hover:bg-danger-subtle/30 transition-colors cursor-pointer"
              >
                <Scissors className="w-3 h-3" aria-hidden="true" /> Cancel
              </button>
            ) : null}

            {onToggleStatus && subscription.status !== 'canceled' ? (
              <button
                type="button"
                onClick={() => onToggleStatus(subscription.id, subscription.status)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                {subscription.status === 'active' ? (
                  <><Pause className="w-3 h-3" aria-hidden="true" /> Pause</>
                ) : (
                  <><Play className="w-3 h-3 text-primary" aria-hidden="true" /> Resume</>
                )}
              </button>
            ) : null}

            <Link
              href={`/subscriptions/${subscription.id}/edit`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <Edit3 className="w-3 h-3" aria-hidden="true" /> Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Cancellation Review Modal (mounted only on demand) */}
      {isCancelModalOpen && (
        <CancellationReviewModal
          subscription={subscription}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
        />
      )}

      {/* Price Hike Review Modal (mounted only on demand) */}
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
