'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Subscription } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { CancellationReviewModal } from './CancellationReviewModal';
import { formatCurrency } from '@/lib/utils/currency';
import { Scissors, ExternalLink } from 'lucide-react';

export function CancelCandidates({ subscriptions }: { subscriptions: Subscription[] }) {
  const [selectedSubForCancel, setSelectedSubForCancel] = useState<Subscription | null>(null);

  const candidates = subscriptions.filter(
    (s) => s.value_rating === 'cancel_candidate' && s.status === 'active'
  );

  if (candidates.length === 0) {
    return null;
  }

  const monthlySavings = candidates.reduce((acc, s) => acc + s.monthly_amount, 0);

  return (
    <>
      <Card className="border-danger/25 bg-danger-subtle/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
            <CardTitle>Cancel Candidates ({candidates.length})</CardTitle>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-semibold text-danger tabular-nums">
              Save {formatCurrency(monthlySavings, 'USD')}/mo
            </span>
            <span className="block text-[11px] text-muted-foreground tabular-nums">
              {formatCurrency(monthlySavings * 12, 'USD')}/yr
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-0 pt-1">
          <div className="divide-y divide-border">
            {candidates.map((sub) => (
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
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {formatCurrency(sub.amount, sub.currency)}
                    </span>
                  </div>
                  {sub.notes ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {sub.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedSubForCancel(sub)}
                    className="text-xs font-medium text-danger hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Cancel Review
                  </button>

                  {sub.cancel_url ? (
                    <a
                      href={sub.cancel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      Portal <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <CancellationReviewModal
        subscription={selectedSubForCancel}
        isOpen={Boolean(selectedSubForCancel)}
        onClose={() => setSelectedSubForCancel(null)}
      />
    </>
  );
}
