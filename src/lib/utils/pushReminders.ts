import { addDays, format, parseISO } from 'date-fns';
import { rollForwardRenewalDate } from './dates';

export type ReminderKind = 'renewal_2d' | 'renewal_0d' | 'trial_2d' | 'trial_0d';

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
}

export interface DueReminder {
  sub: ReminderSub;
  kind: ReminderKind;
  targetDate: string;
  daysUntil: 0 | 2;
}

/** Today's date in India (yyyy-MM-dd), since the cron runs at 9 AM IST. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/**
 * Renewals and free trial endings that are exactly 2 days away or today.
 * Old renewal dates are moved forward by whole cycles first, so a subscription
 * whose saved date has passed still gets its next reminder.
 */
export function findDueReminders(
  subs: ReminderSub[],
  today: string,
  opts: { renewals?: boolean; trials?: boolean } = {}
): DueReminder[] {
  const todayDate = parseISO(today);
  const inTwoDays = format(addDays(todayDate, 2), 'yyyy-MM-dd');
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

    const daysUntil = date === today ? 0 : date === inTwoDays ? 2 : null;
    if (daysUntil === null) continue;
    const kind = `${isTrial ? 'trial' : 'renewal'}_${daysUntil}d` as ReminderKind;
    out.push({ sub, kind, targetDate: date, daysUntil });
  }
  return out;
}

/** Short notification text, e.g. "Netflix renews in 2 days" */
export function reminderText(r: DueReminder, price: string): { title: string; body: string } {
  const name = r.sub.name;
  if (r.kind === 'trial_0d') return { title: `${name} free trial ends today`, body: `Cancel today if you don't want to pay ${price}.` };
  if (r.kind === 'trial_2d') return { title: `${name} free trial ends in 2 days`, body: `After that you pay ${price}.` };
  if (r.kind === 'renewal_0d') return { title: `${name} renews today`, body: `${price} will be charged today.` };
  return { title: `${name} renews in 2 days`, body: `${price} will be charged on ${format(parseISO(r.targetDate), 'd MMM')}.` };
}
