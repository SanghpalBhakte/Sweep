// =============================================================================
// Sift - Annual Savings & Plan Arbitrage Calculation Tests
// Path: src/lib/utils/annualOptimization.test.ts
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  computeAnnualSavings,
  calculateAnnualComparison,
  getAnnualArbitrageCandidates,
} from './annualOptimization';
import { Subscription } from '../types';

describe('computeAnnualSavings', () => {
  // 1. Standard discount case
  it('correctly calculates savings when annual plan is cheaper than paying monthly for 12 months', () => {
    // e.g., $10/month vs $100/year
    const result = computeAnnualSavings(100, 10);

    expect(result.annualAmount).toBe(100);
    expect(result.monthlyAlternativePrice).toBe(10);
    expect(result.yearlyAtMonthlyRate).toBe(120); // 10 * 12
    expect(result.annualSavingsAmount).toBe(20); // 120 - 100
    expect(result.savingsPercent).toBe(17); // Math.round((20 / 120) * 100)
    expect(result.effectiveMonthlyRate).toBe(8.33); // Math.round((100 / 12) * 100) / 100
    expect(result.monthsFreeEquivalent).toBe(2.0); // 20 / 10
    expect(result.insightType).toBe('annual_cheaper');
  });

  // 2. No discount case (Annual price equals monthly * 12)
  it('correctly handles neutral case where annual total equals 12x monthly price', () => {
    // e.g., $10/month vs $120/year
    const result = computeAnnualSavings(120, 10);

    expect(result.annualAmount).toBe(120);
    expect(result.yearlyAtMonthlyRate).toBe(120);
    expect(result.annualSavingsAmount).toBe(0);
    expect(result.savingsPercent).toBe(0);
    expect(result.monthsFreeEquivalent).toBe(0);
    expect(result.effectiveMonthlyRate).toBe(10);
    expect(result.insightType).toBe('equal_price');
  });

  // 3. Negative savings case (Annual price is more expensive than 12x monthly)
  it('flags negative savings when annual plan costs more than paying monthly', () => {
    // e.g., $10/month ($120/yr) vs $150/year
    const result = computeAnnualSavings(150, 10);

    expect(result.annualAmount).toBe(150);
    expect(result.yearlyAtMonthlyRate).toBe(120);
    expect(result.annualSavingsAmount).toBe(-30); // 120 - 150 = -30
    expect(result.savingsPercent).toBe(-25); // Math.round((-30 / 120) * 100)
    expect(result.effectiveMonthlyRate).toBe(12.5);
    expect(result.monthsFreeEquivalent).toBe(-3.0);
    expect(result.insightType).toBe('monthly_cheaper');
  });

  // 4. Decimal pricing case with realistic SaaS pricing
  it('handles realistic decimal pricing and rounds values to 2 decimal places', () => {
    // e.g., $9.99/month vs $95.88/year
    const result = computeAnnualSavings(95.88, 9.99);

    expect(result.annualAmount).toBe(95.88);
    expect(result.monthlyAlternativePrice).toBe(9.99);
    expect(result.yearlyAtMonthlyRate).toBe(119.88); // 9.99 * 12
    expect(result.annualSavingsAmount).toBe(24.0); // 119.88 - 95.88
    expect(result.savingsPercent).toBe(20); // Math.round((24 / 119.88) * 100) = 20
    expect(result.effectiveMonthlyRate).toBe(7.99); // 95.88 / 12 = 7.99
    expect(result.monthsFreeEquivalent).toBe(2.4); // Math.round((24 / 9.99) * 10) / 10 = 2.4
    expect(result.insightType).toBe('annual_cheaper');
  });

  // 5. Missing monthly price case
  it('safely handles missing, null, or undefined monthly alternative price without throwing', () => {
    const nullResult = computeAnnualSavings(120, null);
    expect(nullResult.monthlyAlternativePrice).toBeNull();
    expect(nullResult.yearlyAtMonthlyRate).toBeNull();
    expect(nullResult.annualSavingsAmount).toBeNull();
    expect(nullResult.savingsPercent).toBeNull();
    expect(nullResult.monthsFreeEquivalent).toBeNull();
    expect(nullResult.effectiveMonthlyRate).toBe(10);
    expect(nullResult.insightType).toBe('missing_monthly_price');

    const undefinedResult = computeAnnualSavings(120, undefined);
    expect(undefinedResult.insightType).toBe('missing_monthly_price');
  });

  // 6. Zero or negative monthly price edge case
  it('treats zero or negative monthly price as missing without division-by-zero errors', () => {
    const zeroResult = computeAnnualSavings(120, 0);
    expect(zeroResult.monthlyAlternativePrice).toBeNull();
    expect(zeroResult.insightType).toBe('missing_monthly_price');
    expect(Number.isFinite(zeroResult.effectiveMonthlyRate)).toBe(true);

    const negativeResult = computeAnnualSavings(120, -5);
    expect(negativeResult.monthlyAlternativePrice).toBeNull();
    expect(negativeResult.insightType).toBe('missing_monthly_price');
  });

  // 7. Invalid input handling
  it('guards against invalid annual amounts such as NaN, negative values, or non-finite inputs', () => {
    const nanResult = computeAnnualSavings(NaN, 10);
    expect(nanResult.annualAmount).toBe(0);
    expect(nanResult.effectiveMonthlyRate).toBe(0);
    expect(nanResult.yearlyAtMonthlyRate).toBe(120);
    expect(nanResult.annualSavingsAmount).toBe(120);

    const negAnnualResult = computeAnnualSavings(-100, 10);
    expect(negAnnualResult.annualAmount).toBe(0);
    expect(negAnnualResult.effectiveMonthlyRate).toBe(0);
  });

  // 8. Effective monthly equivalent precision
  it('calculates effective monthly equivalent accurately across various price points', () => {
    expect(computeAnnualSavings(49.99).effectiveMonthlyRate).toBe(4.17); // 49.99 / 12 = 4.1658... -> 4.17
    expect(computeAnnualSavings(199.99).effectiveMonthlyRate).toBe(16.67); // 199.99 / 12 = 16.6658... -> 16.67
    expect(computeAnnualSavings(0).effectiveMonthlyRate).toBe(0);
  });

  // 9. Currency-agnostic pure calculation behavior
  it('operates as a pure numeric function independent of currency symbols', () => {
    // INR example: ₹1,200/mo vs ₹10,800/yr (₹14,400 vs ₹10,800 -> saves ₹3,600)
    const inrResult = computeAnnualSavings(10800, 1200);
    expect(inrResult.yearlyAtMonthlyRate).toBe(14400);
    expect(inrResult.annualSavingsAmount).toBe(3600);
    expect(inrResult.savingsPercent).toBe(25);
    expect(inrResult.effectiveMonthlyRate).toBe(900);
    expect(inrResult.monthsFreeEquivalent).toBe(3.0);
    expect(inrResult.insightType).toBe('annual_cheaper');
  });
});

describe('calculateAnnualComparison (Subscription integration)', () => {
  const mockYearlySub: Subscription = {
    id: 'sub-1',
    user_id: 'user-1',
    name: 'JetBrains All Products Pack',
    amount: 289,
    currency: 'USD',
    billing_cycle: 'yearly',
    status: 'active',
    start_date: '2025-01-01',
    next_renewal_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0], // 15 days away
    is_trial: false,
    reminder_offsets: [7, 3, 1],
    value_rating: 'essential',
    monthly_amount: 24.08,
    monthly_alternative_price: 28.9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('correctly builds comparison result with renewal window status', () => {
    const comparison = calculateAnnualComparison(mockYearlySub, 30);

    expect(comparison.subscription.id).toBe('sub-1');
    expect(comparison.annualAmount).toBe(289);
    expect(comparison.monthlyAlternativePrice).toBe(28.9);
    expect(comparison.yearlyAtMonthlyRate).toBe(346.8); // 28.9 * 12
    expect(comparison.annualSavingsAmount).toBe(57.8); // 346.8 - 289
    expect(comparison.savingsPercent).toBe(17);
    expect(comparison.isWithinReviewWindow).toBe(true);
    expect(comparison.insightType).toBe('annual_cheaper');
  });

  it('marks subscription outside review window when renewal is far in the future', () => {
    const farSub: Subscription = {
      ...mockYearlySub,
      next_renewal_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0], // 120 days away
    };

    const comparison = calculateAnnualComparison(farSub, 30);
    expect(comparison.isWithinReviewWindow).toBe(false);
  });
});

describe('getAnnualArbitrageCandidates', () => {
  const baseMonthlySub: Subscription = {
    id: 'monthly-1',
    user_id: 'user-1',
    name: 'GitHub Copilot',
    amount: 10,
    currency: 'USD',
    billing_cycle: 'monthly',
    status: 'active',
    start_date: '2025-01-01',
    next_renewal_date: '2025-02-01',
    is_trial: false,
    reminder_offsets: [3],
    value_rating: 'essential',
    monthly_amount: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('identifies eligible essential and useful monthly subscriptions with projected savings >= $15/yr', () => {
    const subs: Subscription[] = [
      baseMonthlySub, // $10/mo = $120/yr vs $100/yr projected -> $20 savings -> ELIGIBLE
      {
        ...baseMonthlySub,
        id: 'monthly-2',
        name: 'Figma Professional',
        amount: 15,
        value_rating: 'useful',
      }, // $15/mo = $180/yr vs $150/yr projected -> $30 savings -> ELIGIBLE
      {
        ...baseMonthlySub,
        id: 'monthly-3',
        name: 'Cheap Tool',
        amount: 4, // < $5 -> INELIGIBLE
      },
      {
        ...baseMonthlySub,
        id: 'monthly-4',
        name: 'Cancel Candidate',
        amount: 25,
        value_rating: 'cancel_candidate', // INELIGIBLE
      },
      {
        ...baseMonthlySub,
        id: 'monthly-5',
        name: 'Rarely Used Tool',
        amount: 30,
        value_rating: 'rarely_used', // INELIGIBLE
      },
      {
        ...baseMonthlySub,
        id: 'monthly-6',
        name: 'Trial Tool',
        amount: 20,
        is_trial: true, // INELIGIBLE
      },
      {
        ...baseMonthlySub,
        id: 'yearly-1',
        name: 'Already Annual',
        amount: 120,
        billing_cycle: 'yearly', // INELIGIBLE
      },
    ];

    const candidates = getAnnualArbitrageCandidates(subs, 15);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].subscription.id).toBe('monthly-2'); // Higher savings ($30) first
    expect(candidates[0].projectedAnnualSavings).toBe(30);
    expect(candidates[0].confidence).toBe('medium');

    expect(candidates[1].subscription.id).toBe('monthly-1'); // $20 savings
    expect(candidates[1].projectedAnnualSavings).toBe(20);
    expect(candidates[1].confidence).toBe('high');
  });

  it('respects explicit monthly_alternative_price if user recorded custom comparison', () => {
    const customSub: Subscription = {
      ...baseMonthlySub,
      id: 'custom-1',
      name: 'Custom SaaS',
      amount: 20, // $20/mo = $240/yr
      monthly_alternative_price: 15, // $15/mo equivalent on annual ($180/yr) -> $60 savings
    };

    const candidates = getAnnualArbitrageCandidates([customSub]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].projectedAnnualCost).toBe(180);
    expect(candidates[0].projectedAnnualSavings).toBe(60);
    expect(candidates[0].savingsPercent).toBe(25);
  });

  it('adjusts projected savings correctly when a custom benchmark percentage is provided', () => {
    // $20/mo = $240/yr run-rate
    const sub: Subscription = {
      ...baseMonthlySub,
      id: 'bench-1',
      name: 'Pro Tool',
      amount: 20,
    };

    // 10% benchmark: $240 * 0.90 = $216/yr -> $24 savings
    const cand10 = getAnnualArbitrageCandidates([sub], 15, 10);
    expect(cand10).toHaveLength(1);
    expect(cand10[0].projectedAnnualCost).toBe(216);
    expect(cand10[0].projectedAnnualSavings).toBe(24);
    expect(cand10[0].savingsPercent).toBe(10);

    // 20% benchmark: $240 * 0.80 = $192/yr -> $48 savings
    const cand20 = getAnnualArbitrageCandidates([sub], 15, 20);
    expect(cand20).toHaveLength(1);
    expect(cand20[0].projectedAnnualCost).toBe(192);
    expect(cand20[0].projectedAnnualSavings).toBe(48);
    expect(cand20[0].savingsPercent).toBe(20);
  });

  it('applies per-category benchmark overrides when configured and falls back to global benchmark otherwise', () => {
    const devCategory = { user_id: null, id: 'cat-dev', name: 'Software & Dev', slug: 'dev', color: '#10b981', icon: 'code', created_at: '' };
    const mediaCategory = { user_id: null, id: 'cat-media', name: 'Media & Streaming', slug: 'media', color: '#6366f1', icon: 'tv', created_at: '' };

    const devSub: Subscription = {
      ...baseMonthlySub,
      id: 'sub-dev',
      name: 'GitHub Copilot',
      category_id: 'cat-dev',
      amount: 20, // $240/yr run-rate
    };

    const mediaSub: Subscription = {
      ...baseMonthlySub,
      id: 'sub-media',
      name: 'Netflix Premium',
      category_id: 'cat-media',
      amount: 20, // $240/yr run-rate
    };

    const otherSub: Subscription = {
      ...baseMonthlySub,
      id: 'sub-other',
      name: 'Cloud Storage',
      category_id: null,
      amount: 20, // $240/yr run-rate
    };

    // Global benchmark = 15%, but Dev Tools = 10% override and Media = 20% override
    const categoryOverrides = {
      'cat-dev': 10,
      'cat-media': 20,
    };

    const candidates = getAnnualArbitrageCandidates(
      [devSub, mediaSub, otherSub],
      15,
      15, // global benchmark: 15%
      categoryOverrides,
      [devCategory, mediaCategory]
    );

    expect(candidates).toHaveLength(3);

    // Media sub uses 20% override -> $240 * 0.80 = $192/yr ($48 savings)
    const mediaResult = candidates.find((c) => c.subscription.id === 'sub-media');
    expect(mediaResult?.projectedAnnualCost).toBe(192);
    expect(mediaResult?.projectedAnnualSavings).toBe(48);
    expect(mediaResult?.savingsPercent).toBe(20);
    expect(mediaResult?.eligibilityRule).toContain('20% Media & Streaming override');

    // Dev sub uses 10% override -> $240 * 0.90 = $216/yr ($24 savings)
    const devResult = candidates.find((c) => c.subscription.id === 'sub-dev');
    expect(devResult?.projectedAnnualCost).toBe(216);
    expect(devResult?.projectedAnnualSavings).toBe(24);
    expect(devResult?.savingsPercent).toBe(10);
    expect(devResult?.eligibilityRule).toContain('10% Software & Dev override');

    // Other sub has no category override -> falls back to 15% global -> $240 * 0.85 = $204/yr ($36 savings)
    const otherResult = candidates.find((c) => c.subscription.id === 'sub-other');
    expect(otherResult?.projectedAnnualCost).toBe(204);
    expect(otherResult?.projectedAnnualSavings).toBe(36);
    expect(otherResult?.savingsPercent).toBe(15);
    expect(otherResult?.eligibilityRule).toContain('15% benchmark');
  });
});
