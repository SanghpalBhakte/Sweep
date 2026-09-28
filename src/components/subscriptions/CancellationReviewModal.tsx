'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CancellationReason, Subscription } from '@/lib/types';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { getCancellationMatchedAlternative } from '@/lib/utils/priceHikeDetector';
import { formatCurrency, formatCycle } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  X,
  Scissors,
  Pause,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Portal } from '@/components/ui/Portal';

interface CancellationReviewModalProps {
  subscription: Subscription | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASON_OPTIONS: { id: CancellationReason; label: string; description: string }[] = [
  {
    id: 'too_expensive',
    label: 'Too expensive or price increased',
    description: 'Cost has become difficult to justify for current usage.',
  },
  {
    id: 'not_using_enough',
    label: 'Not using it enough',
    description: 'Underutilized relative to the recurring charge.',
  },
  {
    id: 'temporary_pause',
    label: 'Temporary break / pause',
    description: 'Finished a project or taking a break and may return later.',
  },
  {
    id: 'switching_service',
    label: 'Switching to an alternative',
    description: 'Found a better tool, free tier, or bundled alternative.',
  },
  {
    id: 'duplicate_overlap',
    label: 'Duplicate / overlapping tool',
    description: 'Another active subscription fulfills the same need.',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'No longer needed or service quality changed.',
  },
];

export function CancellationReviewModal({
  subscription,
  isOpen,
  onClose,
  onSuccess,
}: CancellationReviewModalProps) {
  const { updateSubscription } = useSubscriptions();

  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedAction, setCompletedAction] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setSelectedReason(null);
      setCompletedAction(null);

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

  const matchedAlternative = selectedReason
    ? getCancellationMatchedAlternative(selectedReason, subscription)
    : null;

  // Action 1: Full Cancel in Sweep
  const handleConfirmCancelInSweep = async () => {
    setIsSubmitting(true);
    try {
      await updateSubscription(subscription.id, {
        status: 'canceled',
        cancellation_reason: selectedReason || 'other',
        cancellation_effective_date: new Date().toISOString().split('T')[0],
      });
      setCompletedAction('canceled');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action 2: Pause in Sweep (Alternative for temporary pause)
  const handlePauseInSweep = async () => {
    setIsSubmitting(true);
    try {
      await updateSubscription(subscription.id, {
        status: 'paused',
        cancellation_reason: 'temporary_pause',
      });
      setCompletedAction('paused');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to pause subscription:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg sweep-card bg-card border-border shadow-modal rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85dvh]"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-danger-subtle flex items-center justify-center text-danger shrink-0 shadow-xs">
              <Scissors className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="cancel-modal-title" className="text-sm sm:text-base font-bold text-foreground truncate">
                Cancel Review: {subscription.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(subscription.amount, subscription.currency)}
                <span className="text-[11px]">
                  {' '}
                  / {formatCycle(subscription.billing_cycle, subscription.custom_interval_days)}
                </span>
                {' · '}Renews {formatDate(subscription.next_renewal_date)}
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

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {completedAction ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-success-subtle flex items-center justify-center text-success shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">
                  {completedAction === 'paused'
                    ? 'Subscription Paused in Sweep'
                    : 'Subscription Marked Canceled'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  {completedAction === 'paused'
                    ? 'Excluded from active spend run-rate. You can resume anytime.'
                    : 'Updated your Sweep ledger. Remember to also cancel on the merchant portal if active.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Question: One Short Reason */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  What is the main reason for canceling?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REASON_OPTIONS.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedReason(opt.id)}
                      className={cn(
                        'p-2.5 rounded-xl border text-left cursor-pointer transition-all shadow-xs',
                        selectedReason === opt.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-surface/40 hover:bg-surface'
                      )}
                    >
                      <div className="text-xs font-semibold text-foreground">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {opt.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matched Ethical Alternative (Appears when reason selected) */}
              {matchedAlternative ? (
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Suggested Alternative: {matchedAlternative.title}</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {matchedAlternative.description}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {matchedAlternative.recommendedAction === 'pause_review' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={isSubmitting}
                        onClick={handlePauseInSweep}
                        className="text-xs gap-1 shadow-xs"
                      >
                        <Pause className="w-3.5 h-3.5" /> {matchedAlternative.actionButtonLabel}
                      </Button>
                    ) : matchedAlternative.externalLinkUrl ? (
                      <a
                        href={matchedAlternative.externalLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Button variant="outline" size="sm" className="text-xs gap-1 shadow-xs">
                          {matchedAlternative.externalLinkText} <ExternalLink className="w-3 h-3" />
                        </Button>
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Product Honesty & Client-Side Privacy Disclaimer */}
              <div className="p-3 rounded-xl bg-surface/70 border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <span className="font-semibold text-foreground">Client-Side & Privacy-First: </span>
                  Sweep updates your personal ledger and stops renewal notifications. Because Sweep does not store merchant credentials or track bank logins, remember to also complete cancellation directly on {subscription.name}&apos;s billing portal if you haven&apos;t done so.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!completedAction ? (
          <div className="p-4 sm:p-5 border-t border-border flex items-center justify-between gap-3 shrink-0 bg-surface/30">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Keep Active
            </Button>

            <div className="flex items-center gap-2">
              {subscription.cancel_url ? (
                <a
                  href={subscription.cancel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm" className="text-xs gap-1 text-danger hover:border-danger">
                    Direct Cancel <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              ) : null}

              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleConfirmCancelInSweep}
                className="text-xs gap-1 bg-danger hover:bg-danger/90 text-danger-foreground border-danger shadow-xs"
              >
                <Scissors className="w-3.5 h-3.5" /> Mark Canceled in Sweep
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
    </Portal>
  );
}
