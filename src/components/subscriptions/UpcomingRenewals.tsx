'use client';

import React from 'react';
import Link from 'next/link';
import { Subscription } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { formatCurrency, formatCycle } from '@/lib/utils/currency';
import { getCountdownBadge, formatDate } from '@/lib/utils/dates';
import { Badge } from '../ui/Badge';
import { CalendarClock, ArrowRight } from 'lucide-react';

export function UpcomingRenewals({ subscriptions }: { subscriptions: Subscription[] }) {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');

  const upcoming = [...activeSubs]
    .sort((a, b) => new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime())
    .slice(0, 4);

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <CardTitle>Upcoming Renewals</CardTitle>
        </div>
        <Link
          href="/subscriptions"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors shrink-0"
        >
          View all <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-0 pt-1">
        <div className="divide-y divide-border">
          {upcoming.map((sub) => {
            const countdown = getCountdownBadge(sub.next_renewal_date);
            return (
              <div
                key={sub.id}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/subscriptions/${sub.id}/edit`}
                      className="max-md:py-3 max-md:-my-3 text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                    >
                      {sub.name}
                    </Link>
                    <Badge
                      variant={
                        countdown.urgent ? 'danger' : countdown.warning ? 'warning' : 'outline'
                      }
                      size="sm"
                    >
                      {countdown.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDate(sub.next_renewal_date)} · {sub.category?.name || 'General'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(sub.amount, sub.currency)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatCycle(sub.billing_cycle, sub.custom_interval_days)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
