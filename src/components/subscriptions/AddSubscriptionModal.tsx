'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { SubscriptionFormData, BillingCycle, ValueRating } from '@/lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';
import { X, Plus } from 'lucide-react';

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddSubscriptionModal({ isOpen, onClose }: AddSubscriptionModalProps) {
  const { categories, paymentMethods, profile, addSubscription } = useSubscriptions();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(profile?.currency_preference || 'USD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [nextRenewalDate, setNextRenewalDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [valueRating, setValueRating] = useState<ValueRating>('useful');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      const timer = setTimeout(() => {
        if (firstInputRef.current) firstInputRef.current.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length === 0) return;
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === firstElement) { e.preventDefault(); lastElement.focus(); }
          } else {
            if (document.activeElement === lastElement) { e.preventDefault(); firstElement.focus(); }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter a service name.'); return; }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) { setError('Please enter a valid price amount.'); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      await addSubscription({
        name: name.trim(),
        amount: parsedAmount,
        currency,
        billing_cycle: billingCycle,
        status: 'active',
        category_id: categoryId || null,
        payment_method_id: paymentMethodId || null,
        start_date: new Date().toISOString().split('T')[0],
        next_renewal_date: isTrial ? trialEndDate : nextRenewalDate,
        is_trial: isTrial,
        trial_end_date: isTrial ? trialEndDate : null,
        reminder_offsets: profile?.default_reminder_days || [7, 3, 1],
        value_rating: valueRating,
      });
      setName('');
      setAmount('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add subscription.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-180"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-sub-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg bg-card border border-border rounded-modal shadow-popover overflow-hidden max-h-[88vh] flex flex-col animate-in zoom-in-[0.985] fade-in duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Plus className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="quick-add-sub-title" className="text-sm font-semibold text-foreground">
                Add Subscription
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add the basics now. You can edit the rest later.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="max-md:min-h-[44px] max-md:min-w-[44px] max-md:-mr-2 inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {error ? (
            <div className="px-3 py-2.5 text-xs bg-danger-subtle border border-danger/25 text-danger rounded-lg leading-relaxed">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            <Input
              ref={firstInputRef}
              label="Name *"
              placeholder="e.g. GitHub Copilot, Spotify, Figma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Price *"
                type="number"
                step="0.01"
                min="0"
                placeholder="9.99"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Select
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Billing cycle"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly (Annual)</option>
              </Select>
              <Select
                label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">General / Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Payment Method"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
              >
                <option value="">None / Unassigned</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name} {pm.last4 ? `(•••• ${pm.last4})` : ''}
                  </option>
                ))}
              </Select>

              <Input
                label="Next Renewal Date"
                type="date"
                value={isTrial ? trialEndDate : nextRenewalDate}
                onChange={(e) => {
                  if (isTrial) setTrialEndDate(e.target.value);
                  else setNextRenewalDate(e.target.value);
                }}
              />
            </div>

            {/* Free Trial Toggle */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-surface/60 border border-border cursor-pointer hover:bg-surface transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">This is a free trial</span>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  We will remind you before the trial ends and you get charged
                </p>
              </div>
              <input
                type="checkbox"
                checked={isTrial}
                onChange={(e) => setIsTrial(e.target.checked)}
                className="w-4 h-4 rounded accent-primary cursor-pointer ml-4 shrink-0"
              />
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              className="gap-1.5 shadow-xs font-semibold"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Save subscription
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
