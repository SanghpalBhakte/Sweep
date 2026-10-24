import { format } from 'date-fns';
import type { Subscription } from '../types';
import { formatCurrency } from './currency';
import { getDaysUntil } from './dates';

type IcsSub = Pick<
  Subscription,
  'id' | 'name' | 'amount' | 'currency' | 'billing_cycle' | 'custom_interval_days' | 'next_renewal_date' | 'is_trial' | 'trial_end_date' | 'cancel_url'
>;

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Calendar files want lines of at most 75 bytes; longer ones continue on a line starting with a space.
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
    }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function rrule(sub: IcsSub): string {
  switch (sub.billing_cycle) {
    case 'quarterly':
      return 'FREQ=MONTHLY;INTERVAL=3';
    case 'yearly':
      return 'FREQ=YEARLY';
    case 'custom':
      return `FREQ=DAILY;INTERVAL=${Math.max(1, sub.custom_interval_days || 30)}`;
    default:
      return 'FREQ=MONTHLY';
  }
}

/**
 * One repeating all-day event for the next charge (the trial end while a trial is running),
 * with an alarm at 9am the day before.
 */
export function buildSubscriptionIcs(sub: IcsSub, now: Date = new Date()): string {
  const trialEnds = sub.is_trial && sub.trial_end_date && getDaysUntil(sub.trial_end_date) >= 0;
  const date = trialEnds ? sub.trial_end_date! : sub.next_renewal_date;
  const price = formatCurrency(sub.amount, sub.currency);
  const summary = trialEnds
    ? `${sub.name} free trial ends (then ${price})`
    : `${sub.name} renews (${price})`;
  const description = [
    trialEnds ? 'Cancel before today if you do not want to pay.' : `Sweep reminder: ${price} will be charged.`,
    sub.cancel_url ? `Cancel here: ${sub.cancel_url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const day = date.replace(/-/g, '');
  const next = format(new Date(`${date}T00:00:00`).getTime() + 86400000, 'yyyyMMdd');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sweep//Subscription reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${sub.id}@sweep`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${next}`,
    `RRULE:${rrule(sub)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(sub.cancel_url ? [`URL:${sub.cancel_url}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`${sub.name} ${trialEnds ? 'trial ends' : 'renews'} tomorrow`)}`,
    'TRIGGER:-PT15H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Saves the .ics file. Phones open it straight in the calendar app. */
export function downloadSubscriptionIcs(sub: IcsSub): void {
  const blob = new Blob([buildSubscriptionIcs(sub)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sub.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subscription'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
