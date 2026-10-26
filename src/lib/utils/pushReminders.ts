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

/** Today's date in India (yyyy-MM-dd), since the cron runs at 9 AM IST. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

// Used when someone never picked their own reminder days
export const DEFAULT_REMINDER_DAYS = [2, 0];

/**
 * Renewals and free trial endings that are exactly one of the picked reminder
 * days away (a subscription's own days win over the profile default).
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

    const days = sub.reminder_offsets && sub.reminder_offsets.length ? sub.reminder_offsets : fallback;
    const daysUntil = days.find((d) => format(addDays(todayDate, d), 'yyyy-MM-dd') === date);
    if (daysUntil === undefined) continue;
    const kind: ReminderKind = `${isTrial ? 'trial' : 'renewal'}_${daysUntil}d`;
    out.push({ sub, kind, targetDate: date, daysUntil });
  }
  return out;
}

/** Short notification text, e.g. "Netflix renews in 3 days" */
export function reminderText(r: DueReminder, price: string): { title: string; body: string } {
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
