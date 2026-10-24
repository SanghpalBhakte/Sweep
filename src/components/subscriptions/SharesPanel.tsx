'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Subscription, SubscriptionShare } from '@/lib/types';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { formatCurrency } from '@/lib/utils/currency';
import { buildShareRequest, isSharePaid, shareSummary, suggestedShare } from '@/lib/utils/shares';
import { showErrorToast } from '@/lib/toast/toast';
import { cn } from '@/lib/utils/cn';

const linkClass =
  'inline-flex items-center min-h-[44px] font-mono text-xs font-semibold uppercase tracking-[0.04em] underline underline-offset-[5px] decoration-[1.5px] cursor-pointer hover:opacity-70 transition-opacity';

/**
 * "Split with friends" block in the expanded subscription row: who owes what for the
 * charge on next_renewal_date, mark paid, and a Request button that sends a UPI link on WhatsApp.
 */
export function SharesPanel({ subscription }: { subscription: Subscription }) {
  const { updateSubscription, profile } = useSubscriptions();
  const shares = subscription.shares ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const upiId = profile?.upi_id?.trim() || '';
  const canRequest = subscription.currency.toUpperCase() === 'INR';
  const { yourPart, stillOwed } = shareSummary(subscription);

  const save = async (next: SubscriptionShare[]) => {
    setSaving(true);
    try {
      await updateSubscription(subscription.id, { shares: next });
    } catch {
      showErrorToast('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const startAdding = () => {
    setName('');
    setAmount(String(suggestedShare(subscription)));
    setAdding(true);
  };

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!name.trim() || !(value > 0)) return;
    await save([...shares, { name: name.trim(), amount: value, paid_for: null }]);
    setAdding(false);
  };

  const togglePaid = (i: number) =>
    save(
      shares.map((s, j) =>
        j === i ? { ...s, paid_for: isSharePaid(s, subscription) ? null : subscription.next_renewal_date } : s
      )
    );

  const remove = (i: number) => save(shares.filter((_, j) => j !== i));

  const request = (share: SubscriptionShare) => {
    const { whatsapp } = buildShareRequest({
      friend: share.name,
      subName: subscription.name,
      amount: share.amount,
      upiId,
      payeeName: profile?.full_name?.trim() || upiId.split('@')[0],
    });
    window.open(whatsapp, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mt-2 text-xs">
      <p className="font-medium text-foreground">Split with friends</p>

      {shares.length > 0 ? (
        <ul className="mt-0.5">
          {shares.map((share, i) => {
            const paid = isSharePaid(share, subscription);
            return (
              <li key={`${share.name}-${i}`} className="flex flex-wrap items-center gap-x-3">
                <span className={cn('font-mono', paid ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {share.name} owes {formatCurrency(share.amount, subscription.currency)}
                </span>
                <button type="button" disabled={saving} onClick={() => togglePaid(i)} className={linkClass}>
                  {paid ? 'Paid ✓' : 'Mark paid'}
                </button>
                {!paid && canRequest && upiId ? (
                  <button type="button" onClick={() => request(share)} className={cn(linkClass, 'text-primary')}>
                    Request
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => remove(i)}
                  className={cn(linkClass, 'text-muted-foreground')}
                  aria-label={`Remove ${share.name}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {shares.length > 0 ? (
        <p className="font-mono text-muted-foreground">
          You pay {formatCurrency(yourPart, subscription.currency)}
          {stillOwed > 0 ? ` · ${formatCurrency(stillOwed, subscription.currency)} still to collect` : ' · all paid'}
        </p>
      ) : null}

      {shares.length > 0 && canRequest && !upiId ? (
        <p className="text-muted-foreground">
          <Link href="/settings" className="underline underline-offset-2">
            Add your UPI ID in Settings
          </Link>{' '}
          to send a pay link.
        </p>
      ) : null}

      {adding ? (
        <form onSubmit={addPerson} className="mt-1 flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's name"
            aria-label="Friend's name"
            maxLength={40}
            className="sweep-input text-xs py-2 px-3 w-36"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-label="Their share"
            className="sweep-input text-xs py-2 px-3 w-20 font-mono"
          />
          <button type="submit" disabled={saving || !name.trim()} className={linkClass}>
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className={cn(linkClass, 'text-muted-foreground')}>
            Close
          </button>
        </form>
      ) : (
        <button type="button" onClick={startAdding} className={linkClass}>
          + Add person
        </button>
      )}
    </div>
  );
}
