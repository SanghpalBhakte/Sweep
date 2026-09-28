'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnnualComparisonResult, Subscription } from '@/lib/types';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatCurrency } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/dates';
import {
  CalendarClock,
  TrendingDown,
  AlertCircle,
  HelpCircle,
  Check,
  Edit2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface AnnualOptimizationReviewProps {
  items: AnnualComparisonResult[];
  currency?: string;
  showAllIfEmpty?: boolean;
}

export function AnnualOptimizationReview({
  items,
}: AnnualOptimizationReviewProps) {
  const { updateSubscription } = useSubscriptions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputPrice, setInputPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const handleStartEdit = (subId: string, currentPrice: number | null) => {
    setEditingId(subId);
    setInputPrice(currentPrice ? String(currentPrice) : '');
  };

  const handleSavePrice = async (sub: Subscription) => {
    const parsed = parseFloat(inputPrice);
    if (isNaN(parsed) || parsed < 0) return;

    setIsSaving(true);
    try {
      await updateSubscription(sub.id, {
        monthly_alternative_price: parsed > 0 ? parsed : null,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update monthly alternative price:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-primary/30 shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <div>
            <CardTitle>Yearly plans</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Check these before they renew for another year
            </p>
          </div>
        </div>
        <Badge variant="primary" size="sm">
          {items.length} plan{items.length === 1 ? '' : 's'} nearing renewal
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          These numbers compare the yearly and monthly prices you entered. Sweep does not check the company website for price changes.
        </p>

        <div className="divide-y divide-border">
          {items.map((item) => {
            const {
              subscription,
              daysUntilRenewal,
              insightType,
              annualSavingsAmount,
              monthlyAlternativePrice,
              savingsPercent,
            } = item;
            const isEditingThis = editingId === subscription.id;

            return (
              <div
                key={subscription.id}
                className="py-3.5 first:pt-0 last:pb-0 space-y-2.5"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/subscriptions/${subscription.id}/edit`}
                        className="max-md:py-3 max-md:-my-3 text-sm font-bold text-foreground hover:text-primary transition-colors truncate"
                      >
                        {subscription.name}
                      </Link>
                      <Badge
                        variant={daysUntilRenewal <= 14 ? 'warning' : 'outline'}
                        size="sm"
                      >
                        Renews in {daysUntilRenewal} days ({formatDate(subscription.next_renewal_date)})
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <span>Annual Commitment:</span>
                      <strong className="text-foreground font-mono">
                        {formatCurrency(subscription.amount, subscription.currency)}/year
                      </strong>
                      <span>·</span>
                      <span>Effective monthly pace:</span>
                      <strong className="text-foreground font-mono">
                        {formatCurrency(subscription.monthly_amount, subscription.currency)}/mo
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {subscription.cancel_url ? (
                      <a
                        href={subscription.cancel_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-md:py-3 max-md:-my-3 text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        Plan Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <Link
                        href={`/subscriptions/${subscription.id}/edit`}
                        className="max-md:py-3 max-md:-my-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Edit Plan
                      </Link>
                    )}
                  </div>
                </div>

                {/* Insight Callout Block */}
                {insightType === 'annual_cheaper' && annualSavingsAmount !== null ? (
                  <div className="p-3 rounded-lg bg-success-subtle/30 border border-success/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-success flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Annual Plan Discount Secured
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Compared to monthly billing at{' '}
                        {formatCurrency(monthlyAlternativePrice || 0, subscription.currency)}/mo, you
                        save{' '}
                        <strong className="text-success font-mono">
                          {formatCurrency(annualSavingsAmount, subscription.currency)}/year
                        </strong>{' '}
                        ({savingsPercent}% discount).
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(subscription.id, monthlyAlternativePrice || null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground self-start sm:self-auto shrink-0"
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> Edit Monthly Rate
                    </Button>
                  </div>
                ) : insightType === 'monthly_cheaper' && annualSavingsAmount !== null ? (
                  <div className="p-3 rounded-lg bg-danger-subtle/30 border border-danger/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-danger flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Annual Rate Exceeds Monthly Rate
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Billed at {formatCurrency(subscription.amount, subscription.currency)}/yr vs{' '}
                        {formatCurrency(monthlyAlternativePrice || 0, subscription.currency)}/mo. You
                        are paying{' '}
                        <strong className="text-danger font-mono">
                          {formatCurrency(Math.abs(annualSavingsAmount), subscription.currency)}/yr
                        </strong>{' '}
                        more on this annual plan.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(subscription.id, monthlyAlternativePrice || null)}
                      className="text-[11px] text-muted-foreground hover:text-foreground self-start sm:self-auto shrink-0"
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> Edit Monthly Rate
                    </Button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-surface/50 border border-border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        Verify Annual Plan Savings
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Add the monthly plan equivalent price to calculate your exact annual contract
                        discount.
                      </p>
                    </div>
                    {!isEditingThis ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit(subscription.id, null)}
                        className="text-xs shrink-0 self-start sm:self-auto"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Set Monthly Rate
                      </Button>
                    ) : null}
                  </div>
                )}

                {/* Inline Rate Editor */}
                {isEditingThis ? (
                  <div className="p-3 rounded-lg border border-primary/40 bg-card space-y-2 text-xs">
                    <label className="font-medium text-foreground block">
                      What is the standard monthly price for {subscription.name} if billed monthly?
                    </label>
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 15.00"
                        value={inputPrice}
                        onChange={(e) => setInputPrice(e.target.value)}
                        className="py-1 text-xs"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleSavePrice(subscription)}
                        isLoading={isSaving}
                        className="shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" /> Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="shrink-0"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
