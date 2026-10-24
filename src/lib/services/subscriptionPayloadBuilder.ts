import { BillingCycle, SubscriptionFormData, SubscriptionShare } from '../types';
import { normalizeMonthlyAmount } from '../utils/currency';

export interface ProductionSubscriptionInsertPayload {
  user_id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  custom_interval_days: number | null;
  status: 'active' | 'paused' | 'canceled' | 'archived';
  category_id: string | null;
  payment_method_id: string | null;
  start_date: string;
  next_renewal_date: string;
  is_trial: boolean;
  trial_end_date: string | null;
  reminder_offsets: number[];
  value_rating: 'essential' | 'useful' | 'rarely_used' | 'cancel_candidate';
  cancel_url: string | null;
  notes: string | null;
  monthly_amount: number;
}

export interface ProductionSubscriptionUpdatePayload {
  name?: string;
  description?: string | null;
  amount?: number;
  currency?: string;
  billing_cycle?: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  custom_interval_days?: number | null;
  status?: 'active' | 'paused' | 'canceled' | 'archived';
  category_id?: string | null;
  payment_method_id?: string | null;
  start_date?: string;
  next_renewal_date?: string;
  is_trial?: boolean;
  trial_end_date?: string | null;
  reminder_offsets?: number[];
  value_rating?: 'essential' | 'useful' | 'rarely_used' | 'cancel_candidate';
  cancel_url?: string | null;
  notes?: string | null;
  monthly_amount?: number;
  shares?: SubscriptionShare[] | null;
  updated_at?: string;
}

/**
 * Builds an explicit insert payload containing only verified production columns.
 * Guaranteed to match production public.subscriptions schema.
 */
export function buildSubscriptionInsertPayload(
  userId: string,
  form: SubscriptionFormData
): ProductionSubscriptionInsertPayload {
  const monthlyAmount = normalizeMonthlyAmount(
    form.amount,
    form.billing_cycle,
    form.custom_interval_days
  );

  return {
    user_id: userId,
    name: form.name.trim(),
    description: form.description?.trim() || null,
    amount: Number(form.amount),
    currency: (form.currency || 'USD').toUpperCase(),
    billing_cycle: form.billing_cycle || 'monthly',
    custom_interval_days:
      form.billing_cycle === 'custom' && form.custom_interval_days
        ? Number(form.custom_interval_days)
        : null,
    status: form.status || 'active',
    category_id: form.category_id && form.category_id.trim() !== '' ? form.category_id : null,
    payment_method_id:
      form.payment_method_id && form.payment_method_id.trim() !== ''
        ? form.payment_method_id
        : null,
    start_date: form.start_date || new Date().toISOString().split('T')[0],
    next_renewal_date: form.next_renewal_date,
    is_trial: Boolean(form.is_trial),
    trial_end_date: form.is_trial && form.trial_end_date ? form.trial_end_date : null,
    reminder_offsets: Array.isArray(form.reminder_offsets) ? form.reminder_offsets : [3, 1],
    value_rating: form.value_rating || 'useful',
    cancel_url: form.cancel_url?.trim() || null,
    notes: form.notes?.trim() || null,
    monthly_amount: monthlyAmount,
  };
}

/**
 * Builds an explicit update payload containing only verified production columns.
 */
export function buildSubscriptionUpdatePayload(
  existing: {
    amount: number;
    billing_cycle: BillingCycle;
    custom_interval_days?: number | null;
  },
  updates: Partial<SubscriptionFormData>
): ProductionSubscriptionUpdatePayload {
  const billingCycle = (updates.billing_cycle || existing.billing_cycle) as BillingCycle;
  const amount = updates.amount !== undefined ? Number(updates.amount) : existing.amount;
  const customDays =
    updates.custom_interval_days !== undefined
      ? updates.custom_interval_days || undefined
      : existing.custom_interval_days || undefined;
  const monthlyAmount = normalizeMonthlyAmount(amount, billingCycle, customDays);

  const payload: ProductionSubscriptionUpdatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;
  if (updates.amount !== undefined) payload.amount = Number(updates.amount);
  if (updates.currency !== undefined) payload.currency = updates.currency.toUpperCase();
  if (updates.billing_cycle !== undefined) payload.billing_cycle = updates.billing_cycle;
  if (updates.custom_interval_days !== undefined || updates.billing_cycle !== undefined) {
    payload.custom_interval_days =
      (updates.billing_cycle || existing.billing_cycle) === 'custom' && customDays
        ? Number(customDays)
        : null;
  }
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.category_id !== undefined) {
    payload.category_id =
      updates.category_id && updates.category_id.trim() !== '' ? updates.category_id : null;
  }
  if (updates.payment_method_id !== undefined) {
    payload.payment_method_id =
      updates.payment_method_id && updates.payment_method_id.trim() !== ''
        ? updates.payment_method_id
        : null;
  }
  if (updates.start_date !== undefined) payload.start_date = updates.start_date;
  if (updates.next_renewal_date !== undefined)
    payload.next_renewal_date = updates.next_renewal_date;
  if (updates.is_trial !== undefined) payload.is_trial = Boolean(updates.is_trial);
  if (updates.trial_end_date !== undefined || updates.is_trial !== undefined) {
    const isTrial = updates.is_trial !== undefined ? Boolean(updates.is_trial) : false;
    payload.trial_end_date = isTrial && updates.trial_end_date ? updates.trial_end_date : null;
  }
  if (updates.reminder_offsets !== undefined) payload.reminder_offsets = updates.reminder_offsets;
  if (updates.value_rating !== undefined) payload.value_rating = updates.value_rating;
  if (updates.cancel_url !== undefined) payload.cancel_url = updates.cancel_url?.trim() || null;
  if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;
  if (updates.shares !== undefined) payload.shares = updates.shares?.length ? updates.shares : null;
  payload.monthly_amount = monthlyAmount;

  return payload;
}
