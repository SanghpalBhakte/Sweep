import { describe, expect, it } from 'vitest';
import { buildSubscriptionIcs } from './calendar';

const base = {
  id: 'abc',
  name: 'Netflix',
  amount: 499,
  currency: 'INR',
  billing_cycle: 'monthly' as const,
  custom_interval_days: undefined,
  next_renewal_date: '2099-03-05',
  is_trial: false,
  trial_end_date: undefined,
  cancel_url: 'https://www.netflix.com/cancelplan',
};

describe('buildSubscriptionIcs', () => {
  it('makes a repeating all-day event with an alarm the day before', () => {
    const ics = buildSubscriptionIcs(base, new Date('2026-10-24T10:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20990305');
    expect(ics).toContain('DTEND;VALUE=DATE:20990306');
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
    expect(ics).toContain('TRIGGER:-PT15H');
    expect(ics).toContain('DTSTAMP:20261024T100000Z');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it('uses the trial end and the cycle for repeats', () => {
    const ics = buildSubscriptionIcs({ ...base, is_trial: true, trial_end_date: '2099-01-10', billing_cycle: 'quarterly' });
    expect(ics).toContain('DTSTART;VALUE=DATE:20990110');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;INTERVAL=3');
    expect(ics).toContain('free trial ends');
  });

  it('repeats custom cycles every n days', () => {
    const ics = buildSubscriptionIcs({ ...base, billing_cycle: 'custom', custom_interval_days: 28 });
    expect(ics).toContain('RRULE:FREQ=DAILY;INTERVAL=28');
  });
});
