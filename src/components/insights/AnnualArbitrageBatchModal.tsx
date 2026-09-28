'use client';

import React, { useState, useEffect } from 'react';
import { AnnualArbitrageCandidate } from '@/lib/utils/annualOptimization';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { formatCurrency } from '@/lib/utils/currency';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Sparkles,
  TrendingDown,
  ExternalLink,
  Check,
  CheckCircle2,
  HelpCircle,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AnnualArbitrageBatchModalProps {
  isOpen: boolean;
  candidates: AnnualArbitrageCandidate[];
  targetCurrency?: string;
  benchmarkPercent?: number;
  onClose: () => void;
}

export function AnnualArbitrageBatchModal({
  isOpen,
  candidates: initialCandidates,
  targetCurrency = 'USD',
  benchmarkPercent = 16.7,
  onClose,
}: AnnualArbitrageBatchModalProps) {
  const { updateSubscription } = useSubscriptions();

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [convertedIds, setConvertedIds] = useState<string[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeCandidates = initialCandidates.filter(
    (c) => !dismissedIds.includes(c.subscription.id)
  );

  const totalPotentialSavings = activeCandidates.reduce(
    (acc, c) => acc + c.projectedAnnualSavings,
    0
  );

  const handleConvertToAnnual = async (candidate: AnnualArbitrageCandidate) => {
    setUpdatingId(candidate.subscription.id);
    try {
      await updateSubscription(candidate.subscription.id, {
        billing_cycle: 'yearly',
        amount: candidate.projectedAnnualCost,
        monthly_alternative_price: candidate.currentMonthlyCost,
      });
      setConvertedIds((prev) => [...prev, candidate.subscription.id]);
    } catch (err) {
      console.error('Failed to update subscription to annual:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDismissCandidate = (subId: string) => {
    setDismissedIds((prev) => [...prev, subId]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="annual-arbitrage-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs"
    >
      <div
        className="fixed inset-0 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="annual-arbitrage-title"
                  className="text-lg font-bold text-foreground flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5 text-primary shrink-0" />
                  Annual Arbitrage Review
                </h2>
                <Badge variant="primary" size="sm" className="font-mono text-xs">
                  {activeCandidates.length} Candidate{activeCandidates.length === 1 ? '' : 's'}
                </Badge>
                {totalPotentialSavings > 0 ? (
                  <Badge variant="success" size="sm" className="gap-1 font-mono text-xs">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Save ~{formatCurrency(totalPotentialSavings, targetCurrency)}/yr
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review stable monthly subscriptions where converting to annual billing offers significant recurring savings.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="max-md:min-h-[44px] max-md:min-w-[44px] max-md:-mr-2 inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Heuristic Disclaimer Box */}
          <div className="p-3 bg-surface/50 rounded-xl border border-border flex items-start gap-2.5 text-xs text-muted-foreground">
            <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong className="font-semibold text-foreground">Heuristic Rate Comparison: </strong>
              Savings are estimated using your configured {benchmarkPercent}% annual discount benchmark or your recorded plan rates. Sweep does not alter external provider accounts; verify pricing details on the provider portal before switching.
            </p>
          </div>
        </div>

        {/* Scrollable Candidate List */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {activeCandidates.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-surface/30 rounded-xl border border-border">
              <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  All candidates reviewed!
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You have reviewed all eligible annual discount candidates in this batch.
                </p>
              </div>
            </div>
          ) : (
            activeCandidates.map((candidate) => {
              const {
                subscription,
                currentMonthlyCost,
                yearlyAtMonthlyRate,
                projectedAnnualCost,
                projectedAnnualSavings,
                savingsPercent,
                confidence,
                eligibilityRule,
                whyExplanation,
              } = candidate;

              const isConverted = convertedIds.includes(subscription.id);
              const isUpdating = updatingId === subscription.id;

              return (
                <div
                  key={subscription.id}
                  className={cn(
                    'p-4 sm:p-5 rounded-xl border transition-all space-y-3',
                    isConverted
                      ? 'border-success/40 bg-success-subtle/15'
                      : 'border-border bg-card hover:border-border/80 shadow-xs'
                  )}
                >
                  {/* Top Bar: Name, Badges & Rate Math */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-foreground">
                          {subscription.name}
                        </h4>
                        <Badge
                          variant={subscription.value_rating === 'essential' ? 'primary' : 'outline'}
                          size="sm"
                          className="text-[11px] capitalize"
                        >
                          {subscription.value_rating}
                        </Badge>
                        <Badge
                          variant={confidence === 'high' ? 'success' : 'outline'}
                          size="sm"
                          className="text-[11px]"
                        >
                          {confidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <span>
                          Current: {formatCurrency(currentMonthlyCost, subscription.currency)}/mo ({formatCurrency(yearlyAtMonthlyRate, subscription.currency)}/yr)
                        </span>
                      </div>
                    </div>

                    {/* Projected Savings Pill */}
                    <div className="text-left sm:text-right space-y-0.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success-subtle text-success font-mono font-bold text-xs">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Save ~{formatCurrency(projectedAnnualSavings, subscription.currency)}/yr ({savingsPercent}%)
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Projected annual plan: ~{formatCurrency(projectedAnnualCost, subscription.currency)}/yr
                      </div>
                    </div>
                  </div>

                  {/* Why Included & Heuristic Explanation */}
                  <div className="space-y-1 text-xs">
                    <div className="text-muted-foreground leading-relaxed">
                      {whyExplanation}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                      {eligibilityRule}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    {subscription.cancel_url ? (
                      <a
                        href={subscription.cancel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium cursor-pointer"
                      >
                        Open {subscription.name} Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Change plan on {subscription.name}&apos;s billing page
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDismissCandidate(subscription.id)}
                        disabled={isUpdating || isConverted}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Keep Monthly
                      </button>

                      {isConverted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success px-3 py-1.5 rounded-lg bg-success-subtle">
                          <Check className="w-3.5 h-3.5" /> Switched in Sweep
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isUpdating}
                          onClick={() => handleConvertToAnnual(candidate)}
                          className="gap-1.5 text-xs font-semibold shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark Switched to Annual
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-border bg-surface/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>Optional review · No automatic changes made with merchants</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            {activeCandidates.length === 0 ? 'Done' : 'Close Review'}
          </Button>
        </div>
      </div>
    </div>
  );
}
