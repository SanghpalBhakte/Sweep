// =============================================================================
// Sift - Price-Hike Detector & Ethical Cancellation Advisor
// Path: src/lib/utils/priceHikeDetector.ts
// =============================================================================

import { CancellationReason, PriceHikeAlert, Subscription } from '../types';
import { convertCurrency, formatCurrency, normalizeMonthlyAmount } from './currency';
import { formatDate, getDaysUntil } from './dates';
import { DEFAULT_OFFLINE_RATES } from '../services/exchangeRateService';

export interface MatchedAlternative {
  title: string;
  description: string;
  recommendedAction:
    | 'pause_review'
    | 'downgrade_review'
    | 'cadence_switch'
    | 'keep_until_renewal'
    | 'overlap_review'
    | 'confirm_cancel';
  actionButtonLabel: string;
  secondaryOptionLabel?: string;
  externalLinkText?: string;
  externalLinkUrl?: string;
}

/**
 * Returns a calm, single matched alternative based on the user's chosen cancellation reason.
 * Never attempts to guilt-trip or trap the user; keeps direct cancellation accessible.
 */
export function getCancellationMatchedAlternative(
  reason: CancellationReason,
  subscription: Subscription
): MatchedAlternative {
  const nextRenewalFormatted = formatDate(subscription.next_renewal_date);
  const daysUntil = getDaysUntil(subscription.next_renewal_date);

  switch (reason) {
    case 'too_expensive':
      return {
        title: 'Try a cheaper plan first',
        description: `Many apps have a cheaper plan, a student plan, or a lower price if you pay yearly. Check ${subscription.name}'s plans before you cancel.`,
        recommendedAction: 'downgrade_review',
        actionButtonLabel: 'Change plan',
        secondaryOptionLabel: 'Remind me before it renews',
        externalLinkText: subscription.cancel_url ? `See ${subscription.name} plans` : undefined,
        externalLinkUrl: subscription.cancel_url,
      };

    case 'temporary_pause':
      return {
        title: 'Pause it instead',
        description: `Pausing takes it out of your monthly total but keeps the date and notes, so it is easy to turn back on later.`,
        recommendedAction: 'pause_review',
        actionButtonLabel: 'Pause in Sweep',
        secondaryOptionLabel: 'Cancel it fully',
        externalLinkText: subscription.cancel_url ? `Open ${subscription.name}` : undefined,
        externalLinkUrl: subscription.cancel_url,
      };

    case 'not_using_enough':
      return {
        title: `Use it until ${nextRenewalFormatted}`,
        description: `You already paid for this cycle (${daysUntil > 0 ? `${daysUntil} days left` : 'it renews soon'}). Cancel on their site now and you can usually keep using it until then.`,
        recommendedAction: 'keep_until_renewal',
        actionButtonLabel: `Remind me on ${nextRenewalFormatted}`,
        secondaryOptionLabel: 'Cancel now',
        externalLinkText: subscription.cancel_url ? `Cancel on ${subscription.name}` : undefined,
        externalLinkUrl: subscription.cancel_url,
      };

    case 'duplicate_overlap':
      return {
        title: 'Keep just one',
        description: `Look at your list and keep the one you use most. Cancel the rest.`,
        recommendedAction: 'overlap_review',
        actionButtonLabel: 'See all subscriptions',
        secondaryOptionLabel: 'Cancel it',
        externalLinkText: subscription.cancel_url ? `Cancel ${subscription.name}` : undefined,
        externalLinkUrl: subscription.cancel_url,
      };

    case 'switching_service':
      return {
        title: 'Save your stuff first',
        description: `Download or move anything you need from ${subscription.name} before you close it.`,
        recommendedAction: 'confirm_cancel',
        actionButtonLabel: 'Cancel it',
        externalLinkText: subscription.cancel_url ? `Open ${subscription.name}` : undefined,
        externalLinkUrl: subscription.cancel_url,
      };

    case 'missing_value':
    case 'other':
    default:
      return {
        title: 'Also cancel on their site',
        description: `Sweep marks it canceled here. To stop the charge, also cancel it on ${subscription.name}'s app or website.`,
        recommendedAction: 'confirm_cancel',
        actionButtonLabel: 'Mark canceled',
        externalLinkText: subscription.cancel_url ? `Cancel on ${subscription.name}` : undefined,
        externalLinkUrl: subscription.cancel_url,
      };
  }
}

/**
 * Detects subscriptions with recorded price hikes or upcoming cost increase signals.
 */
export function detectPriceHikes(
  subscriptions: Subscription[],
  targetCurrency: string = 'USD',
  rates: Record<string, number> = DEFAULT_OFFLINE_RATES
): PriceHikeAlert[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const alerts: PriceHikeAlert[] = [];

  activeSubs.forEach((sub) => {
    // Check 1: Explicitly recorded price hike where current amount > previous_amount
    if (
      typeof sub.previous_amount === 'number' &&
      sub.previous_amount > 0 &&
      sub.amount > sub.previous_amount
    ) {
      const isReviewed = Boolean(
        sub.price_hike_reviewed_at &&
          new Date(sub.price_hike_reviewed_at) >= new Date(sub.updated_at || sub.created_at)
      );

      const oldMonthly = normalizeMonthlyAmount(sub.previous_amount, sub.billing_cycle);
      const newMonthly = normalizeMonthlyAmount(sub.amount, sub.billing_cycle);
      const monthlyDelta = Math.round((newMonthly - oldMonthly) * 100) / 100;
      const percentageIncrease = Math.round(((sub.amount - sub.previous_amount) / sub.previous_amount) * 100);

      alerts.push({
        id: `hike-recorded-${sub.id}`,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        currentAmount: sub.amount,
        previousAmount: sub.previous_amount,
        currency: sub.currency,
        billingCycle: sub.billing_cycle,
        monthlyDelta,
        percentageIncrease,
        nextRenewalDate: sub.next_renewal_date,
        whyExplanation: `Recorded price increase from ${formatCurrency(sub.previous_amount, sub.currency)} to ${formatCurrency(sub.amount, sub.currency)} (+${percentageIncrease}%).`,
        heuristicRule: 'Recorded history: Current amount > Previous amount',
        isReviewed,
        reviewedAt: sub.price_hike_reviewed_at,
      });
    }
  });

  return alerts;
}
