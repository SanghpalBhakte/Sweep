'use client';

import React from 'react';
import Link from 'next/link';
import { TopSubscriptionItem } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { formatCurrency, formatCycle } from '@/lib/utils/currency';
import { ValueRatingTag } from '../ui/ValueRatingTag';
import { Award, ArrowRight } from 'lucide-react';

interface TopSubscriptionsProps {
  items: TopSubscriptionItem[];
  currency?: string;
}

export function TopSubscriptions({ items, currency = 'USD' }: TopSubscriptionsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <div>
            <CardTitle>Top Cost Drivers</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Subscriptions accounting for the largest share of monthly spend
            </p>
          </div>
        </div>

        <Link
          href="/subscriptions"
          className="max-md:py-3 max-md:-my-3 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 pt-1">
        <div className="divide-y divide-border">
          {items.map(
            (
              { subscription, monthlyAmount, convertedMonthlyAmount, percentageOfTotal },
              index
            ) => {
              const displayAmount = convertedMonthlyAmount || monthlyAmount;

              return (
                <div
                  key={subscription.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-center text-xs font-mono text-muted-foreground font-semibold">
                      #{index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/subscriptions/${subscription.id}/edit`}
                          className="max-md:py-3 max-md:-my-3 text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {subscription.name}
                        </Link>
                        <ValueRatingTag rating={subscription.value_rating} size="sm" />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground mt-0.5">
                        <span>{subscription.category?.name || 'General'}</span>
                        <span>·</span>
                        <span className="font-mono">
                          {formatCurrency(subscription.amount, subscription.currency)}
                          {formatCycle(
                            subscription.billing_cycle,
                            subscription.custom_interval_days
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 whitespace-nowrap">
                    <div className="text-sm font-bold text-foreground font-mono">
                      {formatCurrency(displayAmount, currency, { showCents: false })}
                      <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                        /mo
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {percentageOfTotal}%
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </CardContent>
    </Card>
  );
}
