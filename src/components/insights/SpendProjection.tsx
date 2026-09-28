'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { formatCurrency } from '@/lib/utils/currency';
import { Calendar, TrendingDown } from 'lucide-react';

export function SpendProjection({
  monthlyTotal,
  potentialMonthlySavings,
}: {
  monthlyTotal: number;
  potentialMonthlySavings: number;
}) {
  const yearlyCurrent = monthlyTotal * 12;
  const yearlyOptimized = (monthlyTotal - potentialMonthlySavings) * 12;
  const yearlySavings = potentialMonthlySavings * 12;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <CardTitle>Annual Projection & Optimization</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border border-border bg-card">
            <span className="text-[11px] text-muted-foreground">Current Annual Pace</span>
            <div className="text-lg sm:text-xl font-bold text-foreground mt-1 font-mono">
              {formatCurrency(yearlyCurrent, 'USD')}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {formatCurrency(monthlyTotal, 'USD')}/month
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card">
            <span className="text-[11px] text-muted-foreground">Optimized Annual Spend</span>
            <div className="text-lg sm:text-xl font-bold text-primary mt-1 font-mono">
              {formatCurrency(yearlyOptimized, 'USD')}
            </div>
            <span className="text-[11px] text-muted-foreground">
              After pruning cancel candidates
            </span>
          </div>

          <div className="p-3 rounded-lg border border-success/30 bg-success-subtle/30">
            <span className="text-[11px] text-success font-medium flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> Recoverable Annual Capital
            </span>
            <div className="text-lg sm:text-xl font-bold text-success mt-1 font-mono">
              {formatCurrency(yearlySavings, 'USD')}
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              +{formatCurrency(potentialMonthlySavings, 'USD')}/mo freed cashflow
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
