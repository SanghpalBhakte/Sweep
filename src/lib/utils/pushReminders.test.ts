import { describe, it, expect } from 'vitest';
import { findDueReminders, todayInIndia, ReminderSub } from './pushReminders';

const base: ReminderSub = {
  id: 's1',
  user_id: 'u1',
  name: 'Netflix',
  amount: 649,
  currency: 'INR',
  billing_cycle: 'monthly',
  custom_interval_days: null,
  next_renewal_date: '2026-10-28',
  is_trial: false,
  trial_end_date: null,
  status: 'active',
};

describe('findDueReminders', () => {
  it('finds a renewal 2 days away and one today', () => {
    const due = findDueReminders(
      [base, { ...base, id: 's2', next_renewal_date: '2026-10-26' }, { ...base, id: 's3', next_renewal_date: '2026-10-27' }],
      '2026-10-26'
    );
    expect(due.map((d) => [d.sub.id, d.kind])).toEqual([
      ['s1', 'renewal_2d'],
      ['s2', 'renewal_0d'],
    ]);
  });

  it('uses the trial end date for free trials', () => {
    const due = findDueReminders([{ ...base, is_trial: true, trial_end_date: '2026-10-26', next_renewal_date: '2026-11-30' }], '2026-10-26');
    expect(due[0].kind).toBe('trial_0d');
  });

  it('moves an old renewal date forward before checking', () => {
    const due = findDueReminders([{ ...base, next_renewal_date: '2026-09-28' }], '2026-10-26');
    expect(due[0]).toMatchObject({ kind: 'renewal_2d', targetDate: '2026-10-28' });
  });

  it('skips paused subscriptions and turned off kinds', () => {
    expect(findDueReminders([{ ...base, status: 'paused' }], '2026-10-26')).toEqual([]);
    expect(findDueReminders([base], '2026-10-26', { renewals: false })).toEqual([]);
  });

  it('gets the date in India', () => {
    expect(todayInIndia(new Date('2026-10-25T20:00:00Z'))).toBe('2026-10-26');
  });
});
