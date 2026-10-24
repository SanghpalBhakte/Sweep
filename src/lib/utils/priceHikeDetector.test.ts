// =============================================================================
// Sift - Price Hike Detector & Cancellation Reason Unit Tests
// Path: src/lib/utils/priceHikeDetector.test.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  detectPriceHikes,
  getCancellationMatchedAlternative,
} from './priceHikeDetector';
import { Subscription } from '../types';

function createMockSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: `sub-${Math.random().toString(36).slice(2, 7)}`,
    user_id: 'user-1',
    name: 'Sample Sub',
    amount: 15,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active',
    start_date: '2026-01-01',
    next_renewal_date: '2026-09-01',
    is_trial: false,
    reminder_offsets: [7, 3, 1],
    value_rating: 'useful',
    monthly_amount: 15,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('priceHikeDetector', () => {
  it('detects an unreviewed recorded price hike where current amount is higher than previous amount', () => {
    const subs: Subscription[] = [
      createMockSub({
        name: 'Netflix',
        amount: 22.99,
        previous_amount: 19.99,
        billing_cycle: 'monthly',
      }),
      createMockSub({
        name: 'Spotify',
        amount: 10.99,
        previous_amount: 10.99, // no change
      }),
    ];

    const alerts = detectPriceHikes(subs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].subscriptionName).toBe('Netflix');
    expect(alerts[0].currentAmount).toBe(22.99);
    expect(alerts[0].previousAmount).toBe(19.99);
    expect(alerts[0].monthlyDelta).toBe(3);
    expect(alerts[0].percentageIncrease).toBe(15);
    expect(alerts[0].isReviewed).toBe(false);
  });

  it('marks a price hike as reviewed if price_hike_reviewed_at is present and up to date', () => {
    const subs: Subscription[] = [
      createMockSub({
        name: 'ChatGPT Plus',
        amount: 25,
        previous_amount: 20,
        price_hike_reviewed_at: '2026-08-16T12:00:00Z',
        updated_at: '2026-08-16T11:00:00Z',
      }),
    ];

    const alerts = detectPriceHikes(subs);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].isReviewed).toBe(true);
  });
});

describe('getCancellationMatchedAlternative', () => {
  it('returns downgrade/discount recommendation when reason is too_expensive', () => {
    const sub = createMockSub({ name: 'Framer', cancel_url: 'https://framer.com/cancel' });
    const alternative = getCancellationMatchedAlternative('too_expensive', sub);

    expect(alternative.recommendedAction).toBe('downgrade_review');
    expect(alternative.title).toContain('cheaper plan');
    expect(alternative.externalLinkUrl).toBe('https://framer.com/cancel');
  });

  it('returns pause in Sweep recommendation when reason is temporary_pause', () => {
    const sub = createMockSub({ name: 'Headspace' });
    const alternative = getCancellationMatchedAlternative('temporary_pause', sub);

    expect(alternative.recommendedAction).toBe('pause_review');
    expect(alternative.actionButtonLabel).toBe('Pause in Sweep');
  });

  it('returns keep until renewal reminder recommendation when reason is not_using_enough', () => {
    const sub = createMockSub({ name: 'Duolingo', next_renewal_date: '2026-09-15' });
    const alternative = getCancellationMatchedAlternative('not_using_enough', sub);

    expect(alternative.recommendedAction).toBe('keep_until_renewal');
    expect(alternative.actionButtonLabel).toContain('Remind me');
  });

  it('returns overlap check recommendation when reason is duplicate_overlap', () => {
    const sub = createMockSub({ name: 'Apple Music' });
    const alternative = getCancellationMatchedAlternative('duplicate_overlap', sub);

    expect(alternative.recommendedAction).toBe('overlap_review');
    expect(alternative.title).toBe('Keep just one');
  });
});
