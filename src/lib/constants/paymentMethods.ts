import type { PaymentMethod } from '../types';

export const PAYMENT_METHOD_TYPES = [
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'bank_account', label: 'Net banking / bank account' },
  { value: 'google_pay', label: 'Google Pay' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Wallet / other' },
] as const;

export type AllowedPaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number]['value'];

// Shared rows seeded in supabase/migrations/20261020000000_builtin_categories_and_payment_methods.sql.
// Ids must match. Listed in the order people in India most often pay for subscriptions.
const BUILTIN: [string, string, AllowedPaymentMethodType][] = [
  ['20000000-0000-0000-0000-000000000004', 'UPI', 'upi'],
  ['20000000-0000-0000-0000-000000000010', 'UPI AutoPay', 'upi'],
  ['20000000-0000-0000-0000-000000000001', 'Credit card', 'credit_card'],
  ['20000000-0000-0000-0000-000000000002', 'Debit card', 'debit_card'],
  ['20000000-0000-0000-0000-000000000011', 'Play Store', 'other'],
  ['20000000-0000-0000-0000-000000000012', 'App Store', 'other'],
  ['20000000-0000-0000-0000-000000000003', 'Net banking', 'bank_account'],
  ['20000000-0000-0000-0000-000000000007', 'Google Pay', 'google_pay'],
  ['20000000-0000-0000-0000-000000000005', 'PayPal', 'paypal'],
  ['20000000-0000-0000-0000-000000000006', 'Apple Pay', 'apple_pay'],
  ['20000000-0000-0000-0000-000000000008', 'Cash', 'cash'],
  ['20000000-0000-0000-0000-000000000009', 'Other', 'other'],
];

export const BUILTIN_PAYMENT_METHODS: PaymentMethod[] = BUILTIN.map(([id, name, type]) => ({
  id,
  user_id: null,
  name,
  type,
  last4: null,
  color: null,
  is_default: false,
  created_at: '2024-01-01T00:00:00Z',
}));

const BUILTIN_ORDER = new Map(BUILTIN.map(([id], i) => [id, i]));

const normName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The user's own methods first (default on top, then by name), then the built-in list.
 * A built-in is left out when the user already has one with the same name, so
 * "UPI" never shows twice.
 */
export function withBuiltinPaymentMethods(own: PaymentMethod[]): PaymentMethod[] {
  const byId = new Map<string, PaymentMethod>();
  for (const pm of own) if (!byId.has(pm.id)) byId.set(pm.id, pm);
  const ownNames = new Set([...byId.values()].filter((pm) => !BUILTIN_ORDER.has(pm.id)).map((pm) => normName(pm.name)));
  for (const pm of BUILTIN_PAYMENT_METHODS) {
    if (!byId.has(pm.id) && !ownNames.has(normName(pm.name))) byId.set(pm.id, pm);
  }
  const all = [...byId.values()];
  const mine = all
    .filter((pm) => !BUILTIN_ORDER.has(pm.id))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name));
  const builtin = all
    .filter((pm) => BUILTIN_ORDER.has(pm.id))
    .sort((a, b) => BUILTIN_ORDER.get(a.id)! - BUILTIN_ORDER.get(b.id)!);
  return [...mine, ...builtin];
}

export const isBuiltinPaymentMethod = (pm: Pick<PaymentMethod, 'id'>) => BUILTIN_ORDER.has(pm.id);

/**
 * Plain steps to stop paying, based on how the subscription is paid.
 * Matches the built-in rows by name too, so a user's own "Play Store" or "GPay autopay" works.
 */
export function cancelStepsFor(pm: Pick<PaymentMethod, 'name' | 'type'> | null | undefined): string[] | null {
  if (!pm) return null;
  const n = normName(pm.name);
  if (n.includes('playstore') || n.includes('googleplay')) {
    return [
      'Open the Play Store app.',
      'Tap your profile picture, then Payments and subscriptions, then Subscriptions.',
      'Pick this subscription and tap Cancel subscription.',
    ];
  }
  if (n.includes('appstore') || n.includes('itunes') || pm.type === 'apple_pay') {
    return [
      'Open the Settings app on your iPhone.',
      'Tap your name, then Subscriptions.',
      'Pick this subscription and tap Cancel Subscription.',
    ];
  }
  if (pm.type === 'upi' || pm.type === 'google_pay' || n.includes('autopay') || n.includes('upi')) {
    return [
      'Cancel on the service site or app first.',
      'Open your UPI app (GPay, PhonePe, Paytm or your bank app) and go to Autopay.',
      'Find this subscription and revoke or cancel the mandate.',
    ];
  }
  if (pm.type === 'credit_card' || pm.type === 'debit_card') {
    return [
      'Cancel on the service site or app first.',
      'Then open your card or bank app and check for a saved e-mandate or standing instruction. Remove it if you see one.',
      'Check your next statement to make sure the charge stopped.',
    ];
  }
  if (pm.type === 'bank_account') {
    return [
      'Cancel on the service site or app first.',
      'Then check standing instructions or mandates in your net banking and remove this one.',
    ];
  }
  return null;
}
