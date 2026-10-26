import { describe, it, expect } from 'vitest';
import {
  buildPushPayload,
  findDueReminders,
  formatReminderHour,
  localDateAndHour,
  reminderTag,
  reminderText,
  todayInIndia,
  ReminderSub,
} from './pushReminders';

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
  it('uses 3 and 1 days before, plus the day itself, when nothing was picked', () => {
    const due = findDueReminders(
      [
        { ...base, next_renewal_date: '2026-10-29' },
        { ...base, id: 's2', next_renewal_date: '2026-10-26' },
        { ...base, id: 's3', next_renewal_date: '2026-10-28' },
        { ...base, id: 's4', next_renewal_date: '2026-10-27' },
      ],
      '2026-10-26'
    );
    expect(due.map((d) => [d.sub.id, d.kind])).toEqual([
      ['s1', 'renewal_3d'],
      ['s2', 'renewal_0d'],
      ['s4', 'renewal_1d'],
    ]);
  });

  it('always reminds on the day itself, even when only earlier days were picked', () => {
    const due = findDueReminders([{ ...base, next_renewal_date: '2026-10-26', reminder_offsets: [7] }], '2026-10-26');
    expect(due[0].kind).toBe('renewal_0d');
  });

  it('uses the trial end date for free trials', () => {
    const due = findDueReminders([{ ...base, is_trial: true, trial_end_date: '2026-10-26', next_renewal_date: '2026-11-30' }], '2026-10-26');
    expect(due[0].kind).toBe('trial_0d');
  });

  it('moves an old renewal date forward before checking', () => {
    const due = findDueReminders([{ ...base, next_renewal_date: '2026-09-29' }], '2026-10-26');
    expect(due[0]).toMatchObject({ kind: 'renewal_3d', targetDate: '2026-10-29' });
  });

  it('skips paused subscriptions and turned off kinds', () => {
    expect(findDueReminders([{ ...base, status: 'paused' }], '2026-10-26')).toEqual([]);
    expect(findDueReminders([{ ...base, next_renewal_date: '2026-10-26' }], '2026-10-26', { renewals: false })).toEqual([]);
  });

  it('follows the days the user picked', () => {
    const subs = [base, { ...base, id: 's2', next_renewal_date: '2026-11-02' }, { ...base, id: 's3', next_renewal_date: '2026-10-29' }];
    const due = findDueReminders(subs, '2026-10-26', { defaultDays: [7, 3, 1] });
    expect(due.map((d) => [d.sub.id, d.kind])).toEqual([
      ['s2', 'renewal_7d'],
      ['s3', 'renewal_3d'],
    ]);
  });

  it("a subscription's own days win over the profile", () => {
    const due = findDueReminders([{ ...base, reminder_offsets: [2] }], '2026-10-26', { defaultDays: [7] });
    expect(due[0].kind).toBe('renewal_2d');
  });

  it('writes plain text', () => {
    const [r] = findDueReminders([{ ...base, next_renewal_date: '2026-10-27' }], '2026-10-26', { defaultDays: [1] });
    expect(reminderText(r, '₹649').title).toBe('Netflix renews tomorrow');
  });

  it('gets the date in India', () => {
    expect(todayInIndia(new Date('2026-10-25T20:00:00Z'))).toBe('2026-10-26');
  });
});

describe('timezone and morning time', () => {
  it('reads the date and hour in a timezone', () => {
    // 03:30 UTC is 9:00 AM in India and still the previous evening in New York
    const at = new Date('2026-10-26T03:30:00Z');
    expect(localDateAndHour(at, 'Asia/Kolkata')).toEqual({ date: '2026-10-26', hour: 9 });
    expect(localDateAndHour(at, 'America/New_York')).toEqual({ date: '2026-10-25', hour: 23 });
  });

  it('falls back to India for a missing or broken timezone', () => {
    const at = new Date('2026-10-26T03:30:00Z');
    expect(localDateAndHour(at, null)).toEqual({ date: '2026-10-26', hour: 9 });
    expect(localDateAndHour(at, 'Not/AZone')).toEqual({ date: '2026-10-26', hour: 9 });
  });

  it('gives midnight as hour 0, not 24', () => {
    expect(localDateAndHour(new Date('2026-10-25T18:30:00Z'), 'Asia/Kolkata')).toEqual({ date: '2026-10-26', hour: 0 });
  });

  it('shows times as 12-hour AM/PM', () => {
    expect(formatReminderHour()).toBe('9:00 AM');
    expect(formatReminderHour(0)).toBe('12:00 AM');
    expect(formatReminderHour(12)).toBe('12:00 PM');
    expect(formatReminderHour(18)).toBe('6:00 PM');
  });
});

describe('push payload', () => {
  const [r] = findDueReminders([{ ...base, next_renewal_date: '2026-10-29' }], '2026-10-26');

  it('tags each reminder by kind, subscription and date, so a repeat replaces itself', () => {
    expect(reminderTag(r)).toBe('renewal_3d_s1_2026-10-29');
    const [again] = findDueReminders([{ ...base, next_renewal_date: '2026-10-29' }], '2026-10-26');
    expect(reminderTag(again)).toBe(reminderTag(r));
    const [trial] = findDueReminders([{ ...base, is_trial: true, trial_end_date: '2026-10-29' }], '2026-10-26');
    expect(reminderTag(trial)).not.toBe(reminderTag(r));
  });

  it('is flat with only title, body, tag and url (no data key)', () => {
    const p = buildPushPayload(r, '₹649');
    expect(Object.keys(p).sort()).toEqual(['body', 'tag', 'title', 'url']);
    expect(p).toEqual({
      title: 'Netflix renews in 3 days',
      body: '₹649 will be charged on 29 Oct.',
      tag: 'renewal_3d_s1_2026-10-29',
      url: '/subscriptions/s1/edit',
    });
  });

  it('builds the same words from a plain name, for the email subject', () => {
    const fromEmail = reminderText({ sub: { name: 'Netflix' }, kind: 'renewal_3d', daysUntil: 3, targetDate: '2026-10-29' }, '₹649');
    expect(fromEmail).toEqual(reminderText(r, '₹649'));
  });
});
