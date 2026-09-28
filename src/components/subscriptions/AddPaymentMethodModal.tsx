'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { PaymentMethod } from '@/lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { X, CreditCard, Plus } from 'lucide-react';

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (pm: PaymentMethod) => void;
}

export function AddPaymentMethodModal({
  isOpen,
  onClose,
  onCreated,
}: AddPaymentMethodModalProps) {
  const { addPaymentMethod } = useSubscriptions();

  const [name, setName] = useState('');
  const [type, setType] = useState('credit_card');
  const [last4, setLast4] = useState('');
  const [color, setColor] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setType('credit_card');
      setLast4('');
      setColor('');
      setIsDefault(false);
      setError(null);

      const timer = setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a payment method name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const created = await addPaymentMethod({
        name: name.trim(),
        type,
        last4: last4.trim() ? last4.trim().slice(-4) : null,
        color: color.trim() || null,
        is_default: isDefault,
      });

      onCreated?.(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method.');
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
      aria-labelledby="add-pm-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-card border border-border rounded-modal shadow-popover overflow-hidden flex flex-col animate-in zoom-in-[0.985] fade-in duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <CreditCard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="add-pm-title" className="text-sm font-semibold text-foreground">
                Add Payment Method
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Assign subscriptions to cards, accounts, or digital wallets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="max-md:min-h-[44px] max-md:min-w-[44px] max-md:-mr-2 inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-4 sm:px-5 py-4 space-y-3.5">
          {error ? (
            <div className="px-3 py-2 text-xs bg-danger-subtle border border-danger/25 text-danger rounded-lg leading-relaxed">
              {error}
            </div>
          ) : null}

          <Input
            ref={inputRef}
            label="Payment Method Name *"
            placeholder="e.g. HDFC Visa, Google Pay, SBI Account"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type *"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="bank_account">Bank Account / Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="apple_pay">Apple Pay</option>
              <option value="other">UPI / Digital Wallet / Other</option>
            </Select>

            <Input
              label="Last 4 Digits (Optional)"
              type="text"
              maxLength={4}
              placeholder="4242"
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>

          <Select
            label="Color Tag (Optional)"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            <option value="">Default (Slate)</option>
            <option value="moss">Moss (Green)</option>
            <option value="slate">Slate (Blue)</option>
            <option value="ochre">Ochre (Gold)</option>
            <option value="terracotta">Terracotta (Rust)</option>
            <option value="indigo">Indigo (Navy)</option>
          </Select>

          <label className="flex items-center gap-2 pt-1 max-md:min-h-[44px] text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
            />
            <span>Set as my default payment method</span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="gap-1.5 shadow-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Save Payment Method
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
