'use client';

import React, { useState } from 'react';
import { Category, RecurringCandidate, Subscription, ValueRating } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ChevronDown, ChevronUp, Sparkles, Layers, AlertCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CandidateReviewCardProps {
  candidate: RecurringCandidate;
  categories: Category[];
  existingSubscription?: Subscription;
  onToggleSelect: (id: string) => void;
  onUpdateCandidate: (id: string, updates: Partial<RecurringCandidate>) => void;
}

export function CandidateReviewCard({
  candidate,
  categories,
  existingSubscription,
  onToggleSelect,
  onUpdateCandidate,
}: CandidateReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Count unique raw descriptor variations
  const uniqueDescriptors = new Set(
    candidate.matchedTransactions.map((t) => t.rawDescription.trim())
  );
  const hasDescriptorDrift = uniqueDescriptors.size > 1;

  const getConfidenceBadge = () => {
    if (candidate.confidence === 'high') {
      return (
        <Badge variant="primary" size="sm" className="gap-1">
          <Sparkles className="w-2.5 h-2.5" /> High Confidence
        </Badge>
      );
    }
    if (candidate.confidence === 'medium') {
      return (
        <Badge variant="warning" size="sm">
          Medium Confidence
        </Badge>
      );
    }
    return (
      <Badge variant="outline" size="sm" className="gap-1 text-warning">
        <AlertCircle className="w-2.5 h-2.5" /> Verify Recurrence
      </Badge>
    );
  };

  return (
    <div
      className={cn(
        'rounded-xl border transition-all shadow-xs',
        candidate.selected
          ? 'border-primary bg-card ring-1 ring-primary/20'
          : 'border-border bg-surface/35 opacity-65 hover:opacity-90'
      )}
    >
      <div className="p-4 sm:p-5 space-y-3">
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          {/* Checkbox and Name */}
          <div className="flex items-start gap-3 min-w-0">
            <input
              type="checkbox"
              id={`candidate-checkbox-${candidate.id}`}
              checked={candidate.selected}
              onChange={() => onToggleSelect(candidate.id)}
              className="w-4 h-4 rounded text-primary border-border accent-primary mt-1 cursor-pointer shrink-0"
            />

            <div className="space-y-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={candidate.merchantName}
                    onChange={(e) =>
                      onUpdateCandidate(candidate.id, { merchantName: e.target.value })
                    }
                    className="h-8 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="p-1 text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    onClick={() => setIsEditing(true)}
                    title="Click to edit name"
                    className="text-base font-bold text-foreground hover:text-primary cursor-pointer truncate"
                  >
                    {candidate.merchantName}
                  </h3>
                  {getConfidenceBadge()}

                  {!candidate.selected ? (
                    <span className="text-[11px] font-medium text-muted-foreground italic">
                      (Excluded from import)
                    </span>
                  ) : null}

                  {hasDescriptorDrift ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface border border-border text-muted-foreground">
                      <Layers className="w-2.5 h-2.5 text-primary" />
                      Grouped {uniqueDescriptors.size} variants
                    </span>
                  ) : null}

                  {existingSubscription ? (
                    <Badge variant="success" size="sm" className="gap-1 font-mono text-[10px]">
                      <TrendingUp className="w-3 h-3" />
                      Already in your list
                    </Badge>
                  ) : null}
                </div>
              )}

              {/* Price delta comparison against existing subscription if amounts differ */}
              {existingSubscription && candidate.amount !== existingSubscription.amount ? (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-warning">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <span>
                    Price change observed: {formatCurrency(existingSubscription.amount, existingSubscription.currency)} →{' '}
                    {formatCurrency(candidate.amount, candidate.currency)}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>
                  {candidate.transactionCount} matched charge
                  {candidate.transactionCount === 1 ? '' : 's'}
                </span>
                <span>·</span>
                <span>
                  Latest charge: {formatDate(candidate.lastDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Amount & Cadence */}
          <div className="text-right shrink-0">
            <div className="text-base sm:text-lg font-bold text-foreground font-mono">
              {formatCurrency(candidate.amount, candidate.currency)}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {candidate.billingCycle}
            </div>
          </div>
        </div>

        {/* Configurations Row (Category, Cadence, Value Rating) */}
        {candidate.selected ? (
          <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Category Selector */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={candidate.suggestedCategoryId || ''}
                onChange={(e) =>
                  onUpdateCandidate(candidate.id, { suggestedCategoryId: e.target.value || null })
                }
                className="sweep-input w-full h-8 px-2 py-1 text-xs"
              >
                <option value="">General & Other</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Billing Cycle */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Cadence
              </label>
              <select
                value={candidate.billingCycle}
                onChange={(e) =>
                  onUpdateCandidate(candidate.id, {
                    billingCycle: e.target.value as RecurringCandidate['billingCycle'],
                  })
                }
                className="sweep-input w-full h-8 px-2 py-1 text-xs"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Value Rating */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Value Tier
              </label>
              <select
                value={candidate.valueRating}
                onChange={(e) =>
                  onUpdateCandidate(candidate.id, {
                    valueRating: e.target.value as ValueRating,
                  })
                }
                className="sweep-input w-full h-8 px-2 py-1 text-xs"
              >
                <option value="essential">Essential</option>
                <option value="useful">Useful</option>
                <option value="rarely_used">Rarely Used</option>
                <option value="cancel_candidate">Cancel Candidate</option>
              </select>
            </div>
          </div>
        ) : null}

        {/* Collapsible matched transaction history */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Hide transaction history
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> View {candidate.matchedTransactions.length} source transaction{candidate.matchedTransactions.length === 1 ? '' : 's'}
              </>
            )}
          </button>

          {isExpanded ? (
            <div className="mt-2 p-3 rounded-lg bg-surface/40 border border-border/40 space-y-2 text-xs">
              <div className="text-xs font-medium text-muted-foreground pb-1.5 border-b border-border/40">
                Matched Statement Charges:
              </div>
              <div className="divide-y divide-border/30 max-h-36 overflow-y-auto">
                {candidate.matchedTransactions.map((tx, idx) => (
                  <div
                    key={idx}
                    className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs text-muted-foreground"
                  >
                    <span className="font-mono tabular-nums">{formatDate(tx.date)}</span>
                    <span className="truncate max-w-[200px] text-foreground font-mono text-[11px]">
                      {tx.rawDescription}
                    </span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">
                      {formatCurrency(tx.amount, candidate.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
