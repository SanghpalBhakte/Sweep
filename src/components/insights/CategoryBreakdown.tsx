'use client';

import React from 'react';
import { Category, Subscription } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { calculateCategoryBreakdown } from '@/lib/utils/analytics';
import { formatCurrency } from '@/lib/utils/currency';
import { PieChart } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const CHART_COLOR_CLASSES = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
];

export function CategoryBreakdown({
  subscriptions,
  categories,
  currency = 'USD',
  rates,
}: {
  subscriptions: Subscription[];
  categories: Category[];
  currency?: string;
  rates?: Record<string, number>;
}) {
  const [hoveredCategoryId, setHoveredCategoryId] = React.useState<string | null>(null);
  const breakdown = calculateCategoryBreakdown(subscriptions, categories, currency, rates);
  const totalSpend = breakdown.reduce((acc, b) => acc + b.totalMonthly, 0);

  const hoveredItem = breakdown.find((b) => b.category.id === hoveredCategoryId);

  if (breakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            <CardTitle>Category Distribution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No active subscriptions found to categorize.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" />
          <CardTitle>Monthly Spend by Category</CardTitle>
        </div>
        <span className="text-xs font-semibold text-foreground font-mono tabular-nums">
          {formatCurrency(totalSpend, currency)}/mo total
        </span>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Visual Multi-segment Bar with Tooltip */}
        <div className="relative pt-1">
          {hoveredItem ? (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-10 sweep-chart-tooltip whitespace-nowrap font-mono text-xs flex items-center gap-1.5 animate-in fade-in zoom-in-[0.98] duration-instant">
              <span className="font-sans font-medium text-foreground">{hoveredItem.category.name}:</span>
              <span className="font-semibold text-foreground">{formatCurrency(hoveredItem.totalMonthly, currency)}/mo</span>
              <span className="text-muted-foreground font-normal">({hoveredItem.percentage}%)</span>
            </div>
          ) : null}

          <div className="h-3 w-full rounded-full bg-surface-muted overflow-hidden flex cursor-pointer">
            {breakdown.map((item, idx) => {
              const barColor = CHART_COLOR_CLASSES[idx % CHART_COLOR_CLASSES.length];
              const isHovered = hoveredCategoryId === item.category.id;

              return (
                <div
                  key={item.category.id}
                  style={{ width: `${Math.max(item.percentage, 2)}%` }}
                  onMouseEnter={() => setHoveredCategoryId(item.category.id)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                  className={cn(
                    barColor,
                    'h-full transition-opacity',
                    hoveredCategoryId && !isHovered ? 'opacity-40' : 'opacity-100'
                  )}
                  role="img"
                  aria-label={`${item.category.name}: ${item.percentage}% (${formatCurrency(item.totalMonthly, currency)}/mo)`}
                />
              );
            })}
          </div>
        </div>

        {/* Detailed Category Rows */}
        <div className="space-y-1 pt-1">
          {breakdown.map((item, idx) => {
            const dotColor = CHART_COLOR_CLASSES[idx % CHART_COLOR_CLASSES.length];
            const isHovered = hoveredCategoryId === item.category.id;

            return (
              <div
                key={item.category.id}
                onMouseEnter={() => setHoveredCategoryId(item.category.id)}
                onMouseLeave={() => setHoveredCategoryId(null)}
                className={cn(
                  'flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer',
                  isHovered ? 'bg-surface/70' : 'hover:bg-surface/40'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
                  <span className="font-medium text-foreground truncate">
                    {item.category.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({item.count} service{item.count === 1 ? '' : 's'})
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="font-semibold text-foreground font-mono tabular-nums">
                    {formatCurrency(item.totalMonthly, currency)}/mo
                  </span>
                  <span className="text-xs text-muted-foreground w-9 text-right font-mono tabular-nums">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
