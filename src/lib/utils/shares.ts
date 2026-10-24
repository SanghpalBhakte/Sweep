import { Subscription, SubscriptionShare } from '../types';
import { formatCurrency } from './currency';

type ShareSub = Pick<Subscription, 'amount' | 'next_renewal_date'> & {
  shares?: SubscriptionShare[] | null;
};

/** True when this person already paid for the charge due on next_renewal_date. */
export function isSharePaid(share: SubscriptionShare, sub: Pick<Subscription, 'next_renewal_date'>) {
  return share.paid_for === sub.next_renewal_date;
}

/** What you pay yourself after friends pay their part, and what is still to collect this cycle. */
export function shareSummary(sub: ShareSub) {
  const shares = sub.shares ?? [];
  const friendsTotal = shares.reduce((sum, s) => sum + s.amount, 0);
  const stillOwed = shares.filter((s) => !isSharePaid(s, sub)).reduce((sum, s) => sum + s.amount, 0);
  return {
    yourPart: Math.max(0, Math.round((sub.amount - friendsTotal) * 100) / 100),
    stillOwed: Math.round(stillOwed * 100) / 100,
  };
}

/** Even split suggestion when adding one more person (you count as one). */
export function suggestedShare(sub: ShareSub) {
  const people = (sub.shares?.length ?? 0) + 2;
  return Math.round(sub.amount / people);
}

/** Loose check for an address like name@okaxis or 98xxxxxx@ybl. */
export function isValidUpiId(value: string) {
  return /^[\w.-]{2,}@[a-zA-Z][a-zA-Z0-9]{1,}$/.test(value.trim());
}

/** A UPI deep link that opens GPay, PhonePe, Paytm and others with the amount filled in. */
export function buildUpiLink(opts: { upiId: string; payeeName: string; amount: number; note: string }) {
  const params = new URLSearchParams({
    pa: opts.upiId.trim(),
    pn: opts.payeeName,
    am: opts.amount.toFixed(2),
    cu: 'INR',
    tn: opts.note.slice(0, 50),
  });
  // UPI apps expect %20, not +, for spaces
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** WhatsApp link with a ready message asking a friend to pay their share. */
export function buildShareRequest(opts: {
  friend: string;
  subName: string;
  amount: number;
  upiId: string;
  payeeName: string;
}) {
  const upi = buildUpiLink({
    upiId: opts.upiId,
    payeeName: opts.payeeName,
    amount: opts.amount,
    note: `${opts.subName} share`,
  });
  const text =
    `Hi ${opts.friend}, your share for ${opts.subName} this time is ${formatCurrency(opts.amount, 'INR')}.\n` +
    `Pay here: ${upi}\n` +
    `Or send it to my UPI ID: ${opts.upiId.trim()}`;
  return { upi, text, whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}` };
}
