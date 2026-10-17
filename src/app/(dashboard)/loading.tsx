import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in duration-100">
      {/* 1. Asymmetric Dual-Card Skeleton (matches exact layout geometry) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* Primary Spend Card Skeleton (7 Columns) */}
        <div className="sm:col-span-7 sweep-card p-5 sm:p-6 flex flex-col justify-between min-h-[160px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
              Recurring spend
            </span>
            <div className="flex items-center gap-0.5 p-0.5 bg-surface border border-border/80 rounded-lg text-xs">
              <span className="px-2 py-0.5 rounded-md font-medium text-[11px] text-foreground bg-card shadow-xs">
                Monthly
              </span>
              <span className="px-2 py-0.5 rounded-md font-medium text-[11px] text-muted-foreground">
                Yearly
              </span>
            </div>
          </div>

          <div className="min-h-[58px] my-auto py-2">
            <div className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums flex items-baseline">
              <span className="opacity-40 animate-pulse font-mono">$0.00</span>
              <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1.5 font-sans">
                /mo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 min-h-[16px]">
              <span className="opacity-50">Calculating recurring commitments...</span>
            </p>
          </div>
        </div>

        {/* Secondary Next Renewal Skeleton (5 Columns) */}
        <div className="sm:col-span-5 sweep-card p-5 flex flex-col justify-between min-h-[160px] bg-card/60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
              Next renewal
            </span>
            <div className="w-14 h-5 skeleton rounded-full" />
          </div>

          <div className="my-auto py-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 skeleton rounded-lg shrink-0" />
              <div className="h-4 w-28 skeleton rounded-md" />
            </div>
            <div className="flex justify-between items-center pt-1">
              <div className="h-3 w-16 skeleton rounded-md" />
              <div className="h-4 w-14 skeleton rounded-md" />
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Auto-renews</span>
            <span className="text-foreground/80">Ledger →</span>
          </div>
        </div>
      </div>

      {/* 2. Supporting Notes Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface/50 border border-border/70 flex items-center justify-between gap-3 min-h-[50px]">
          <div className="h-4 w-32 skeleton rounded-md" />
          <div className="h-4 w-16 skeleton rounded-md" />
        </div>
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface/50 border border-border/70 flex items-center justify-between gap-3 min-h-[50px]">
          <div className="h-4 w-28 skeleton rounded-md" />
          <div className="h-4 w-20 skeleton rounded-md" />
        </div>
      </div>

      {/* 3. Subscription Rows Skeletons */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-sm font-serif font-bold text-foreground">Active ledger</span>
          <span className="text-[11px] text-muted-foreground">Full ledger →</span>
        </div>

        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="skeleton sweep-card"
            style={{
              height: '70px',
              borderRadius: '12px',
            }}
          />
        ))}
      </div>
    </div>
  );
}
