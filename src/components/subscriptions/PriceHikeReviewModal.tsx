'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Subscription } from '@/lib/types';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { formatCurrency, formatCycle } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  X,
  TrendingUp,
  CheckCircle2,
  Bell,
  Scissors,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Portal } from '@/components/ui/Portal';

interface PriceHikeReviewModalProps {
  subscription: Subscription | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCancelModal?: (sub: Subscription) => void;
}

export function PriceHikeReviewModal({
  subscription,
  isOpen,
  onClose,
  onOpenCancelModal,
}: PriceHikeReviewModalProps) {
  const { updateSubscription } = useSubscriptions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedMessage, setCompletedMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setCompletedMessage(null);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen || !subscription) return null;

  const prevAmount = subscription.previous_amount || 0;
  const currentAmount = subscription.amount;
  const delta = Math.max(0, Math.round((currentAmount - prevAmount) * 100) / 100);
  const percentage = prevAmount > 0 ? Math.round(((currentAmount - prevAmount) / prevAmount) * 100) : 0;

  // Action 1: Accept new price and dismiss alert
  const handleAcceptPrice = async () => {
    setIsSubmitting(true);
    try {
      await updateSubscription(subscription.id, {
        price_hike_reviewed_at: new Date().toISOString(),
      });
      setCompletedMessage('Price change accepted and marked reviewed.');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to accept price hike:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action 2: Set reminder and acknowledge price
  const handleSetReminderAndAccept = async () => {
    setIsSubmitting(true);
    try {
      await updateSubscription(subscription.id, {
        price_hike_reviewed_at: new Date().toISOString(),
        reminder_offsets: [7, 3, 1],
      });
      setCompletedMessage('Renewal reminders enabled (7, 3, 1 days before).');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to set reminder:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action 3: Open Cancel Modal
  const handleProceedToCancel = () => {
    onClose();
    if (onOpenCancelModal) {
      onOpenCancelModal(subscription);
    }
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-hike-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md sweep-card bg-card border-border shadow-modal rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85dvh]"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-warning-subtle flex items-center justify-center text-warning shrink-0 shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="price-hike-modal-title" className="text-sm sm:text-base font-bold text-foreground truncate">
                Price Increase: {subscription.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Next renewal on {formatDate(subscription.next_renewal_date)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="max-md:min-h-[44px] max-md:min-w-[44px] max-md:-mr-2 inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {completedMessage ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-success-subtle flex items-center justify-center text-success shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">{completedMessage}</p>
            </div>
          ) : (
            <>
              {/* Price Delta Visual Card */}
              <div className="p-4 rounded-xl bg-surface/60 border border-border flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Previous Amount
                  </div>
                  <div className="text-sm font-semibold text-muted-foreground line-through tabular-nums">
                    {formatCurrency(prevAmount, subscription.currency)}
                  </div>
                </div>

                <div className="text-center">
                  <Badge variant="warning" size="sm" className="font-mono text-[11px]">
                    +{percentage}%
                  </Badge>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    (+{formatCurrency(delta, subscription.currency)}/{subscription.billing_cycle})
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                    New Amount
                  </div>
                  <div className="text-base font-bold text-foreground tabular-nums">
                    {formatCurrency(currentAmount, subscription.currency)}
                  </div>
                </div>
              </div>

              {/* Heuristic Explanation */}
              <div className="p-3 rounded-xl bg-surface/40 border border-border/80 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  <span>Why this appears</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Based on your recorded ledger history, this subscription increased by {formatCurrency(delta, subscription.currency)}/
                  {subscription.billing_cycle}. Sweep detects price changes strictly from your imported statements and manual updates.
                  You can mark this price acceptable to dismiss alerts, set renewal reminders, or review cancellation options.
                </p>
              </div>

              {/* Actions List */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleAcceptPrice}
                  className="w-full p-3 rounded-xl border border-border bg-card hover:bg-surface hover:border-primary/40 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      Accept & Keep at New Price
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Dismisses price hike alerts and continues tracking.
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSetReminderAndAccept}
                  className="w-full p-3 rounded-xl border border-border bg-card hover:bg-surface hover:border-primary/40 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      Set Reminders Before Next Charge
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Remind me 7, 3, and 1 days before {formatDate(subscription.next_renewal_date)}.
                    </div>
                  </div>
                  <Bell className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleProceedToCancel}
                  className="w-full p-3 rounded-xl border border-danger/25 bg-danger-subtle/20 hover:bg-danger-subtle/30 transition-all text-left flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-danger">
                      Review Cancellation / Alternatives
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Evaluate alternatives or mark canceled in Sweep.
                    </div>
                  </div>
                  <Scissors className="w-4 h-4 text-danger shrink-0" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
