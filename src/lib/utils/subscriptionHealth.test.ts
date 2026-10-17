// =============================================================================
// Sift - Subscription Health Action Center Heuristic Engine Unit Tests
// Path: src/lib/utils/subscriptionHealth.test.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import { generateSubscriptionHealthActions } from './subscriptionHealth';
import { Subscription, Category } from '../types';

const mockCategories: Category[] = [
  { user_id: null, id: 'cat-1', name: 'Entertainment', slug: 'entertainment', color: '#ff0000', icon: 'tv', created_at: '' },
  { user_id: null, id: 'cat-2', name: 'Productivity', slug: 'productivity', color: '#00ff00', icon: 'zap', created_at: '' },
  { user_id: null, id: 'cat-3', name: 'Cloud & Hosting', slug: 'cloud', color: '#0000ff', icon: 'cloud', created_at: '' },
];

function createMockSub(overrides: Partial<Subscription>): Subscription {
  return {
    id: `sub-${Math.random().toString(36).slice(2, 7)}`,
    user_id: 'user-1',
    name: 'Sample Sub',
    amount: 10,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active',
    start_date: '2026-01-01',
    next_renewal_date: '2026-09-01',
    is_trial: false,
    reminder_offsets: [7, 3, 1],
    value_rating: 'useful',
    monthly_amount: 10,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('generateSubscriptionHealthActions', () => {
  it('returns a clean, calm state with 100 health score when all subscriptions are in good standing', () => {
    const subs: Subscription[] = [
      createMockSub({ name: 'Figma', amount: 15, value_rating: 'essential', next_renewal_date: '2026-09-15' }),
      createMockSub({ name: 'Linear', amount: 8, value_rating: 'useful', next_renewal_date: '2026-09-20' }),
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    expect(result.healthScore).toBe(100);
    expect(result.statusLabel).toBe('Calm & Optimized');
    expect(result.actionsCount).toBe(0);
    expect(result.urgentCount).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('detects expiring free trials and assigns urgent severity with clear explanation', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const subs: Subscription[] = [
      createMockSub({
        name: 'The Athletic',
        amount: 7.99,
        is_trial: true,
        trial_end_date: todayStr,
        next_renewal_date: todayStr,
        cancel_url: 'https://theathletic.com/account',
      }),
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    expect(result.actionsCount).toBe(1);
    expect(result.urgentCount).toBe(1);
    expect(result.statusLabel).toBe('Action Required');
    expect(result.items[0].type).toBe('trial_expiring');
    expect(result.items[0].severity).toBe('urgent');
    expect(result.items[0].cancelUrl).toBe('https://theathletic.com/account');
    expect(result.items[0].heuristicRule).toContain('Rule: Active trial');
  });

  it('detects user-flagged cancel candidates and calculates potential monthly/annual savings', () => {
    const subs: Subscription[] = [
      createMockSub({
        name: 'Unused Gym App',
        amount: 29.99,
        value_rating: 'cancel_candidate',
        monthly_amount: 29.99,
      }),
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    expect(result.actionsCount).toBe(1);
    expect(result.urgentCount).toBe(1);
    expect(result.potentialMonthlySavings).toBe(29.99);
    expect(result.potentialAnnualSavings).toBe(Math.round(29.99 * 12 * 100) / 100);
    expect(result.items[0].type).toBe('cancel_candidate');
  });

  it('flags upcoming annual plan renewals within 30 days', () => {
    // 10 days in the future
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const subs: Subscription[] = [
      createMockSub({
        name: 'AWS Annual Plan',
        amount: 480,
        billing_cycle: 'yearly',
        next_renewal_date: futureDate,
      }),
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    const annualAction = result.items.find((i) => i.type === 'annual_renewal_due');
    expect(annualAction).toBeDefined();
    expect(annualAction?.severity).toBe('warning');
    expect(annualAction?.impactAmount).toBe(480);
    expect(annualAction?.heuristicRule).toContain('Yearly plan');
  });

  it('flags potential overlapping services within known clusters like AI assistants', () => {
    const subs: Subscription[] = [
      createMockSub({ name: 'ChatGPT Plus', amount: 20, monthly_amount: 20 }),
      createMockSub({ name: 'Claude Pro', amount: 20, monthly_amount: 20 }),
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    const overlapAction = result.items.find((i) => i.type === 'service_overlap');
    expect(overlapAction).toBeDefined();
    expect(overlapAction?.title).toContain('AI Assistants');
    expect(overlapAction?.relatedSubscriptions).toHaveLength(2);
    expect(overlapAction?.impactAmount).toBe(40);
  });

  it('flags outsized single cost concentration if an item represents >= 28% of budget with 3+ subs', () => {
    const subs: Subscription[] = [
      createMockSub({ name: 'Datadog Pro', amount: 150, monthly_amount: 150 }),
      createMockSub({ name: 'GitHub', amount: 10, monthly_amount: 10 }),
      createMockSub({ name: 'Vercel', amount: 20, monthly_amount: 20 }),
    ]; // Total $180/mo, Datadog is 150/180 = 83%

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    const outsized = result.items.find((i) => i.type === 'outsized_cost');
    expect(outsized).toBeDefined();
    expect(outsized?.title).toContain('Datadog Pro');
    expect(outsized?.whyExplanation).toContain('one-quarter');
  });

  it('flags unreviewed recorded price hike where current amount > previous amount', () => {
    const subs: Subscription[] = [
      createMockSub({
        name: 'Disney Plus',
        amount: 15.99,
        previous_amount: 11.99,
        billing_cycle: 'monthly',
      }),
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    const hikeAction = result.items.find((i) => i.type === 'price_hike');
    expect(hikeAction).toBeDefined();
    expect(hikeAction?.severity).toBe('warning');
    expect(hikeAction?.title).toContain('Disney Plus');
    expect(hikeAction?.subtitle).toContain('11.99');
    expect(hikeAction?.subtitle).toContain('15.99');
  });

  it('sorts urgent items before warning and info items', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const subs: Subscription[] = [
      createMockSub({ name: 'Sub 1', amount: 10, billing_cycle: 'yearly', next_renewal_date: futureDate }), // warning
      createMockSub({ name: 'Sub 2', amount: 20, value_rating: 'cancel_candidate' }), // urgent
      createMockSub({ name: 'ChatGPT', amount: 20 }), // info (overlap with Claude)
      createMockSub({ name: 'Claude', amount: 20 }), // info
    ];

    const result = generateSubscriptionHealthActions(subs, mockCategories, 'USD');

    expect(result.items[0].severity).toBe('urgent');
    expect(result.items.some((i) => i.severity === 'warning')).toBe(true);
    expect(result.items.some((i) => i.severity === 'info')).toBe(true);
  });
});
