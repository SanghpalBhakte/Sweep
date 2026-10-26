import { addDays, format, parseISO } from 'date-fns';
import { rollForwardRenewalDate } from './dates';

/** e.g. renewal_3d, trial_0d: what it is and how many days before */
export type ReminderKind = `${'renewal' | 'trial'}_${number}d`;

export interface ReminderSub {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string | null;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  custom_interval_days: number | null;
  next_renewal_date: string | null;
  is_trial: boolean | null;
  trial_end_date: string | null;
  status: string;
  reminder_offsets?: number[] | null;
}

export interface DueReminder {
  sub: ReminderSub;
  kind: ReminderKind;
  targetDate: string;
  daysUntil: number;
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Reminders go out from this hour of the morning, in each person's own timezone. */
export const REMINDER_HOUR = 9;

/** A renewal reminder is still useful hours later; a test is not. */
export const REMINDER_TTL_SECONDS = 6 * 60 * 60;
export const TEST_TTL_SECONDS = 15 * 60;

/** Today's date in India (yyyy-MM-dd). */
export function todayInIndia(now: Date = new Date()): string {
  return localDateAndHour(now, DEFAULT_TIMEZONE).date;
}

/** The date (yyyy-MM-dd) and hour (0-23) in a timezone. A bad timezone falls back to India. */
export function localDateAndHour(now: Date, timeZone: string | null | undefined): { date: string; hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return localDateAndHour(now, DEFAULT_TIMEZONE);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** e.g. "9:00 AM" */
export function formatReminderHour(hour: number = REMINDER_HOUR): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

// Same as the database default for profiles.default_reminder_days
export const DEFAULT_REMINDER_DAYS = [3, 1];

/**
 * Renewals and free trial endings that are exactly one of the picked reminder
 * days away, or today (a subscription's own days win over the profile default).
 * The day itself always counts, the same as reminder emails.
 * Old renewal dates are moved forward by whole cycles first, so a subscription
 * whose saved date has passed still gets its next reminder.
 */
export function findDueReminders(
  subs: ReminderSub[],
  today: string,
  opts: { renewals?: boolean; trials?: boolean; defaultDays?: number[] | null } = {}
): DueReminder[] {
  const todayDate = parseISO(today);
  const fallback = opts.defaultDays && opts.defaultDays.length ? opts.defaultDays : DEFAULT_REMINDER_DAYS;
  const out: DueReminder[] = [];

  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const isTrial = Boolean(sub.is_trial && sub.trial_end_date);
    if (isTrial ? opts.trials === false : opts.renewals === false) continue;

    const date = isTrial
      ? sub.trial_end_date!
      : sub.next_renewal_date
      ? rollForwardRenewalDate(sub.next_renewal_date, sub.billing_cycle, sub.custom_interval_days, todayDate)
      : null;
    if (!date) continue;

    const picked = sub.reminder_offsets && sub.reminder_offsets.length ? sub.reminder_offsets : fallback;
    const days = picked.includes(0) ? picked : [...picked, 0];
    const daysUntil = days.find((d) => format(addDays(todayDate, d), 'yyyy-MM-dd') === date);
    if (daysUntil === undefined) continue;
    const kind: ReminderKind = `${isTrial ? 'trial' : 'renewal'}_${daysUntil}d`;
    out.push({ sub, kind, targetDate: date, daysUntil });
  }
  return out;
}

/** Short reminder text, e.g. "Netflix renews in 3 days". Used for push and email alike. */
export function reminderText(
  r: Pick<DueReminder, 'kind' | 'daysUntil' | 'targetDate'> & { sub: Pick<ReminderSub, 'name'> },
  price: string
): { title: string; body: string } {
  const name = r.sub.name;
  const when = r.daysUntil === 0 ? 'today' : r.daysUntil === 1 ? 'tomorrow' : `in ${r.daysUntil} days`;
  const on = format(parseISO(r.targetDate), 'd MMM');
  if (r.kind.startsWith('trial')) {
    return {
      title: `${name} free trial ends ${when}`,
      body: r.daysUntil === 0 ? `Cancel today if you don't want to pay ${price}.` : `After ${on} you pay ${price}.`,
    };
  }
  return {
    title: `${name} renews ${when}`,
    body: r.daysUntil === 0 ? `${price} will be charged today.` : `${price} will be charged on ${on}.`,
  };
}

/** One tag per reminder, so a repeat replaces the one already showing instead of stacking. */
export function reminderTag(r: DueReminder): string {
  return `${r.kind}_${r.sub.id}_${r.targetDate}`;
}

/** Where tapping the notification goes */
export function reminderUrl(subscriptionId: string): string {
  return `/subscriptions/${encodeURIComponent(subscriptionId)}/edit`;
}

/** Everything the service worker needs, flat, and nothing else (no ids beyond the link). */
export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

export function buildPushPayload(r: DueReminder, price: string): PushPayload {
  return { ...reminderText(r, price), tag: reminderTag(r), url: reminderUrl(r.sub.id) };
}
