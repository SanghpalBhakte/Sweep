'use client';

import React, { useState } from 'react';
import { SpendTrendPoint } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { formatCurrency } from '@/lib/utils/currency';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SpendTrendChartProps {
  data: SpendTrendPoint[];
  currency?: string;
}

export function SpendTrendChart({ data, currency = 'USD' }: SpendTrendChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<SpendTrendPoint | null>(null);

  if (data.length === 0 || data.every((d) => d.totalMonthly === 0)) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <CardTitle>Monthly spend</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-xs text-muted-foreground">
            Not enough history yet to show a trend.
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxSpend = Math.max(...data.map((d) => d.totalMonthly), 10);
  const currentMonth = data[data.length - 1];
  const firstMonth = data[0];
  const diff = currentMonth.totalMonthly - firstMonth.totalMonthly;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <div>
            <CardTitle>Monthly spend</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Your monthly total over the last 6 months
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-bold text-foreground font-mono">
            {formatCurrency(currentMonth.totalMonthly, currency)}
            <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
          </div>
          {diff !== 0 ? (
            <span
              className={cn(
                'text-[10px] font-medium font-mono',
                diff > 0 ? 'text-muted-foreground' : 'text-primary'
              )}
            >
              {diff > 0 ? `+${formatCurrency(diff, currency)}` : `-${formatCurrency(Math.abs(diff), currency)}`} vs {firstMonth.monthLabel}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="pt-2 space-y-3">
        {/* Hover info pill */}
        <div className="h-7 flex items-center justify-between text-xs px-2.5 rounded-md bg-surface/40 border border-border/40 transition-all">
          <span className="text-xs text-muted-foreground">
            {hoveredPoint ? hoveredPoint.monthLabel : 'This month'}
          </span>
          <span className="font-semibold text-foreground text-xs font-mono tabular-nums">
            {hoveredPoint
              ? `${formatCurrency(hoveredPoint.totalMonthly, currency)}/mo (${hoveredPoint.activeCount} active)`
              : `${formatCurrency(currentMonth.totalMonthly, currency)}/mo (${currentMonth.activeCount} active)`}
          </span>
        </div>

        {/* Calm Bar / Area Chart Container */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-6 items-end gap-2 sm:gap-3 h-36 border-b border-border/40 pb-2 px-1">
            {data.map((point) => {
              const heightPercent = Math.max(
                Math.round((point.totalMonthly / maxSpend) * 100),
                8
              );
              const isLatest = point.yearMonth === currentMonth.yearMonth;
              const isHovered = hoveredPoint?.yearMonth === point.yearMonth;

              return (
                <div
                  key={point.yearMonth}
                  className="flex flex-col items-center justify-end h-full group cursor-pointer relative"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => setHoveredPoint(point)}
                >
                  {/* Tooltip on bar */}
                  {isHovered ? (
                    <div className="absolute -top-8 z-10 sweep-chart-tooltip whitespace-nowrap font-mono text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in zoom-in-[0.98] duration-instant">
                      <span>{formatCurrency(point.totalMonthly, currency)}</span>
                    </div>
                  ) : null}

                  {/* Bar */}
                  <div className="w-full max-w-[32px] sm:max-w-[40px] flex-1 min-h-0 flex items-end justify-center rounded-t-md overflow-hidden bg-surface transition-all">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={cn(
                        'w-full rounded-t-md transition-all duration-300',
                        isLatest
                          ? 'bg-chart-1'
                          : isHovered
                          ? 'bg-chart-2'
                          : 'bg-chart-1/35'
                      )}
                    />
                  </div>

                  {/* Month Label */}
                  <span
                    className={cn(
                      'text-[11px] mt-2 font-medium transition-colors',
                      isLatest || isHovered
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground'
                    )}
                  >
                    {point.monthLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend note */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-chart-1" /> Monthly total
          </span>
          <span>Last 6 months</span>
        </div>
      </CardContent>
    </Card>
  );
}
