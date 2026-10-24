import { describe, expect, it } from 'vitest';
import { format, addDays } from 'date-fns';
import { calculateKillListYearlySavings, calculateUpcoming30DayCharges, getKillList } from './analytics';
import type { Subscription } from '../types';

const day = (n: number) => format(addDays(new Date(), n), 'yyyy-MM-dd');

const sub = (over: Partial<Subscription>): Subscription =>
  ({
    id: over.name || 'x',
    name: 'x',
    amount: 100,
    currency: 'INR',
    billing_cycle: 'monthly',
    status: 'active',
    next_renewal_date: day(5),
    ...over,
  }) as Subscription;

const total = (subs: Subscription[]) =>
  calculateUpcoming30DayCharges(subs, 30, 'INR').reduce((a, i) => a + i.convertedAmount, 0);

describe('calculateUpcoming30DayCharges', () => {
  it('counts yearly and 3 month plans once, at full price', () => {
    expect(total([sub({ name: 'y', billing_cycle: 'yearly', amount: 1499 })])).toBe(1499);
    expect(total([sub({ name: 'q', billing_cycle: 'quarterly', amount: 599 })])).toBe(599);
  });

  it('counts short custom plans every time they repeat', () => {
    // day 2, 9, 16, 23, 30
    expect(total([sub({ name: 'w', billing_cycle: 'custom', custom_interval_days: 7, next_renewal_date: day(2) })])).toBe(500);
  });

  it('includes day 30 and leaves out day 31', () => {
    expect(total([sub({ name: 'far', next_renewal_date: day(31) })])).toBe(0);
    expect(total([sub({ name: 'near', next_renewal_date: day(30) })])).toBe(100);
  });
});

describe('kill list', () => {
  const subs = [
    sub({ name: 'a', value_rating: 'rarely_used', amount: 149 }),
    sub({ name: 'b', value_rating: 'cancel_candidate', amount: 599, billing_cycle: 'quarterly' }),
    sub({ name: 'c', value_rating: 'cancel_candidate', status: 'paused' }),
    sub({ name: 'd', value_rating: 'essential' }),
  ];

  it('has active rarely used and cancel subs only', () => {
    expect(getKillList(subs).map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('adds up a year of each', () => {
    expect(calculateKillListYearlySavings(subs, 'INR')).toBe(149 * 12 + 599 * 4);
  });

  it('counts only your part of a split sub', () => {
    const split = sub({ name: 's', value_rating: 'rarely_used', amount: 139, shares: [{ name: 'Rahul', amount: 70 }] });
    expect(calculateKillListYearlySavings([split], 'INR')).toBe(69 * 12);
  });
});
