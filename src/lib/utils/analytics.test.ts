import { describe, expect, it } from 'vitest';
import { format, addDays } from 'date-fns';
import { calculateUpcoming30DayCharges } from './analytics';
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
    // day 2, 9, 16, 23 are inside the 30 days; day 30 is not
    expect(total([sub({ name: 'w', billing_cycle: 'custom', custom_interval_days: 7, next_renewal_date: day(2) })])).toBe(400);
  });

  it('leaves out charges 30 or more days away', () => {
    expect(total([sub({ name: 'far', next_renewal_date: day(30) })])).toBe(0);
    expect(total([sub({ name: 'near', next_renewal_date: day(29) })])).toBe(100);
  });
});
