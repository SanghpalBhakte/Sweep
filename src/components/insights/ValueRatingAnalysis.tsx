'use client';

import React from 'react';
import { Subscription } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { calculateValueRatingBreakdown } from '@/lib/utils/analytics';
import { formatCurrency } from '@/lib/utils/currency';
import { ShieldCheck, ThumbsUp, HelpCircle, Scissors, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function ValueRatingAnalysis({
  subscriptions,
  currency = 'USD',
  rates,
}: {
  subscriptions: Subscription[];
  currency?: string;
  rates?: Record<string, number>;
}) {
  const breakdown = calculateValueRatingBreakdown(subscriptions, currency, rates);
  const cancelCandidate = breakdown.find((b) => b.rating === 'cancel_candidate');

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'essential':
        return <ShieldCheck className="w-4 h-4 text-primary" />;
      case 'useful':
        return <ThumbsUp className="w-4 h-4 text-foreground" />;
      case 'rarely_used':
        return <HelpCircle className="w-4 h-4 text-warning" />;
      case 'cancel_candidate':
        return <Scissors className="w-4 h-4 text-danger" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <CardTitle>Is it worth it?</CardTitle>
        </div>
        {cancelCandidate && cancelCandidate.totalMonthly > 0 ? (
          <span className="text-xs text-danger font-medium font-mono">
            Save up to {formatCurrency(cancelCandidate.totalMonthly, currency)}/mo
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        <p className="text-xs text-muted-foreground leading-relaxed">
          This is based on how you rated each subscription. Sweep never tracks your apps or browser, so
          only you know what is worth keeping.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {breakdown.map((item) => (
            <div
              key={item.rating}
              className={cn(
                'p-3 rounded-lg border flex flex-col justify-between gap-2',
                item.rating === 'cancel_candidate' && item.count > 0
                  ? 'border-danger/30 bg-danger-subtle/25'
                  : 'border-border bg-surface/50'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  {getRatingIcon(item.rating)}
                  {item.label}
                </div>
                <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                  {item.count} {item.count === 1 ? 'item' : 'items'} ({item.percentage}%)
                </span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-border/60">
                <span className="text-[11px] text-muted-foreground">Monthly spend</span>
                <span className="text-sm font-semibold text-foreground font-mono">
                  {formatCurrency(item.totalMonthly, currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
