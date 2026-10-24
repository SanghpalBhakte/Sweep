import { describe, expect, it } from 'vitest';
import { format, addDays } from 'date-fns';
import { deriveAppAlerts } from './reminders';
import type { Subscription } from '../types';

const day = (n: number) => format(addDays(new Date(), n), 'yyyy-MM-dd');

const sub = (over: Partial<Subscription>): Subscription =>
  ({
    id: 'yt',
    name: 'YouTube Premium',
    amount: 149,
    currency: 'INR',
    billing_cycle: 'monthly',
    status: 'active',
    is_trial: false,
    next_renewal_date: day(5),
    ...over,
  }) as Subscription;

describe('deriveAppAlerts', () => {
  it('shows one alert when a trial ends on the renewal day', () => {
    const alerts = deriveAppAlerts([sub({ is_trial: true, trial_end_date: day(5) })]);
    expect(alerts.map((a) => a.type)).toEqual(['trial_ending']);
  });

  it('keeps both when the trial ends on a different day', () => {
    const alerts = deriveAppAlerts([sub({ is_trial: true, trial_end_date: day(2) })]);
    expect(alerts.map((a) => a.type).sort()).toEqual(['renewal_upcoming', 'trial_ending']);
  });
});
