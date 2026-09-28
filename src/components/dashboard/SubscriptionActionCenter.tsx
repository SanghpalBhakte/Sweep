'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSubscriptions } from '@/context/SubscriptionContext';
import {
  generateSubscriptionHealthActions,
  HealthActionItem,
  ActionSeverity,
} from '@/lib/utils/subscriptionHealth';
import { Subscription } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button, ButtonLink } from '../ui/Button';
import { AnimatedCurrency } from '../ui/AnimatedCurrency';
import { CancellationReviewModal } from '../subscriptions/CancellationReviewModal';
import { PriceHikeReviewModal } from '../subscriptions/PriceHikeReviewModal';
import { AnnualArbitrageBatchModal } from '../insights/AnnualArbitrageBatchModal';
import { getAnnualArbitrageCandidates } from '@/lib/utils/annualOptimization';
import { formatCurrency } from '@/lib/utils/currency';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Sparkles,
  ExternalLink,
  Scissors,
  ArrowRight,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type FilterTab = 'all' | 'urgent' | 'warning' | 'info';

export function SubscriptionActionCenter() {
  const {
    subscriptions,
    categories,
    profile,
    displayCurrency,
    exchangeRates,
  } = useSubscriptions();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedSubForCancel, setSelectedSubForCancel] = useState<Subscription | null>(null);
  const [selectedSubForPriceHike, setSelectedSubForPriceHike] = useState<Subscription | null>(null);
  const [isArbitrageModalOpen, setIsArbitrageModalOpen] = useState(false);

  const targetCurrency = displayCurrency || 'USD';
  const userBenchmark = profile?.annual_benchmark_percent || 16.7;
  const categoryOverrides = profile?.category_annual_benchmarks || {};
  const arbitrageCandidates = getAnnualArbitrageCandidates(
    subscriptions,
    15,
    userBenchmark,
    categoryOverrides,
    categories
  );
  const totalArbitrageSavings = arbitrageCandidates.reduce(
    (acc, c) => acc + c.projectedAnnualSavings,
    0
  );

  const summary = generateSubscriptionHealthActions(
    subscriptions,
    categories,
    targetCurrency,
    exchangeRates.rates
  );

  const {
    healthScore,
    statusLabel,
    items,
    urgentCount,
    warningCount,
    infoCount,
    potentialMonthlySavings,
    totalActiveCount,
  } = summary;

  // Filter items based on active tab
  const filteredItems = items.filter((item) => {
    if (activeTab === 'urgent') return item.severity === 'urgent';
    if (activeTab === 'warning') return item.severity === 'warning';
    if (activeTab === 'info') return item.severity === 'info';
    return true;
  });

  const getSeverityBadge = (severity: ActionSeverity) => {
    switch (severity) {
      case 'urgent':
        return (
          <Badge variant="danger" size="sm" className="gap-1 font-semibold">
            <ShieldAlert className="w-3 h-3" /> Urgent Action
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="warning" size="sm" className="gap-1 font-semibold">
            <Clock className="w-3 h-3" /> Review Due
          </Badge>
        );
      case 'info':
        return (
          <Badge variant="outline" size="sm" className="gap-1 text-primary border-primary/20 bg-primary/5">
            <Sparkles className="w-3 h-3 text-primary" /> Optimization
          </Badge>
        );
    }
  };

  // Check history depth for price-hike trends
  const subsWithHistory = subscriptions.filter(
    (s) => s.status === 'active' && typeof s.previous_amount === 'number' && s.previous_amount > 0
  );

  // If no active subscriptions tracked, return null (dashboard empty state handles it)
  if (totalActiveCount === 0) {
    return null;
  }

  // PRISTINE "CALM & OPTIMIZED" STATE (0 action items)
  if (items.length === 0) {
    return (
      <Card className="border-success/30 bg-success-subtle/15">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-success-subtle flex items-center justify-center text-success shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">
                  Subscription Health: Calm & Optimized
                </h3>
                <Badge variant="success" size="sm" className="gap-1 font-mono">
                  Health Score 100/100
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                All {totalActiveCount} active subscriptions are in good standing based on your recorded ledger entries and declared value ratings.
                {subsWithHistory.length === 0
                  ? ' Price-hike monitoring is in baseline mode; Sweep will automatically detect price trends when a second statement or price edit is recorded.'
                  : ` No price increases detected across ${subsWithHistory.length} recorded history comparisons.`}
              </p>
            </div>
          </div>

          <ButtonLink href="/subscriptions" variant="outline" size="sm" className="shrink-0 self-start sm:self-center text-xs gap-1">
            View All Subscriptions <ArrowRight className="w-3 h-3" />
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border shadow-xs overflow-hidden">
        {/* Header Bar */}
        <CardHeader className="border-b border-border/70 pb-3 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert
                    className={cn(
                      'w-4 h-4 shrink-0',
                      urgentCount > 0
                        ? 'text-danger'
                        : warningCount > 0
                        ? 'text-warning'
                        : 'text-primary'
                    )}
                    aria-hidden="true"
                  />
                  <CardTitle className="text-sm sm:text-base">
                    Financial Action Center
                  </CardTitle>
                </div>

                <Badge
                  variant={
                    healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'danger'
                  }
                  size="sm"
                  className="font-mono text-[11px]"
                >
                  Health Score {healthScore}/100 · {statusLabel}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                {summary.statusDescription}
              </p>
            </div>

            {/* Potential Monthly Savings Indicator */}
            {potentialMonthlySavings > 0 ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success-subtle/30 border border-success/25 shrink-0">
                <TrendingDown className="w-4 h-4 text-success shrink-0" />
                <div>
                  <div className="text-xs font-bold text-foreground">
                    +<AnimatedCurrency value={potentialMonthlySavings} currency={targetCurrency} />
                    <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Identified cancel savings
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Tab Filters */}
          <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer',
                activeTab === 'all'
                  ? 'bg-surface text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Actions ({items.length})
            </button>

            {urgentCount > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('urgent')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1',
                  activeTab === 'urgent'
                    ? 'bg-danger-subtle text-danger shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-danger'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                Urgent ({urgentCount})
              </button>
            ) : null}

            {warningCount > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('warning')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1',
                  activeTab === 'warning'
                    ? 'bg-warning-subtle text-warning shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-warning'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                Review Due ({warningCount})
              </button>
            ) : null}

            {infoCount > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center gap-1',
                  activeTab === 'info'
                    ? 'bg-primary/10 text-primary shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-primary'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Optimizations ({infoCount})
              </button>
            ) : null}
          </div>
        </CardHeader>

        {/* Optional 1-Click Annual Arbitrage Grouped Review Banner */}
        {arbitrageCandidates.length >= 2 && (activeTab === 'all' || activeTab === 'info') ? (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 sm:p-4 rounded-xl border border-primary/25 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground">
                    Annual Arbitrage: {arbitrageCandidates.length} Candidates Identified
                  </h4>
                  <Badge variant="success" size="sm" className="gap-1 font-mono text-[11px]">
                    <TrendingDown className="w-3 h-3" />
                    Save ~{formatCurrency(totalArbitrageSavings, targetCurrency)}/yr
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  High-value monthly subscriptions that could save ~15–20% on annual billing. Review the group without auto-converting.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsArbitrageModalOpen(true)}
              className="text-xs font-semibold shrink-0 gap-1.5 self-start sm:self-center shadow-xs cursor-pointer"
            >
              Review All ({arbitrageCandidates.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : null}

        {/* Action Cards List */}
        <CardContent className="p-0 divide-y divide-border mt-3">
          {filteredItems.map((action) => {
            const correspondingSub = subscriptions.find((s) => s.id === action.subscriptionId);

            return (
              <div
                key={action.id}
                className={cn(
                  'p-4 sm:p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4',
                  action.severity === 'urgent'
                    ? 'bg-danger-subtle/5 hover:bg-danger-subtle/10'
                    : action.severity === 'warning'
                    ? 'bg-warning-subtle/5 hover:bg-warning-subtle/10'
                    : 'hover:bg-surface/40'
                )}
              >
                {/* Left Info & Explanation */}
                <div className="space-y-2 min-w-0 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityBadge(action.severity)}
                    <h4 className="text-sm font-bold text-foreground">
                      {action.title}
                    </h4>
                    <span className="text-xs font-semibold font-mono text-muted-foreground">
                      {action.impactLabel}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {action.subtitle}
                  </p>

                  {/* Transparent "Why this appears" reason tag */}
                  <div className="inline-flex items-start gap-1.5 px-2.5 py-1 rounded-lg bg-surface/70 border border-border/80 text-[11px] text-muted-foreground leading-snug">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold text-foreground">Why this appears: </strong>
                      <span>{action.whyExplanation}</span>{' '}
                      <span className="font-mono text-[11px] text-muted-foreground/80">({action.heuristicRule})</span>
                    </div>
                  </div>

                  {/* Related Subscriptions (For Overlap Clusters) */}
                  {action.relatedSubscriptions && action.relatedSubscriptions.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {action.relatedSubscriptions.map((rel) => (
                        <Link
                          key={rel.id}
                          href={`/subscriptions/${rel.id}/edit`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 max-md:min-h-[44px] rounded-md text-[11px] font-medium bg-card border border-border text-foreground hover:border-primary transition-colors"
                        >
                          <span>{rel.name}</span>
                          <span className="text-muted-foreground font-mono">
                            ({formatCurrency(rel.amount, rel.currency)})
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-start md:self-center pt-2 md:pt-0">
                  {action.cancelUrl ? (
                    <a
                      href={action.cancelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button variant="outline" size="sm" className="text-xs gap-1 text-danger hover:border-danger">
                        Direct Cancel <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  ) : null}

                  {action.type === 'price_hike' && correspondingSub ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSubForPriceHike(correspondingSub)}
                      className="text-xs gap-1 text-warning hover:border-warning"
                    >
                      <TrendingUp className="w-3.5 h-3.5" /> Review Increase
                    </Button>
                  ) : action.type === 'cancel_candidate' && correspondingSub ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSubForCancel(correspondingSub)}
                      className="text-xs gap-1 text-danger hover:bg-danger-subtle hover:border-danger"
                    >
                      <Scissors className="w-3.5 h-3.5" /> Cancel Review
                    </Button>
                  ) : (
                    <ButtonLink href={action.actionUrl || '/subscriptions'} variant={action.severity === 'urgent' ? 'primary' : 'outline'} size="sm" className="text-xs gap-1 shadow-xs">
                      {action.suggestedActionLabel} <ChevronRight className="w-3.5 h-3.5" />
                    </ButtonLink>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>

        {/* Privacy-First Ledger Boundary Footer */}
        <div className="p-3 bg-surface/40 border-t border-border flex items-start gap-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong className="font-semibold text-foreground">Client-Side & Privacy-First: </strong>
            Sweep does not monitor external app logins, browser activity, or live merchant plan feeds. Downgrade suggestions
            and utilization insights rely on visible pricing tiers and your declared value ratings, while price-hike alerts require recorded statement history.
          </p>
        </div>
      </Card>

      {/* Cancellation Review Modal */}
      <CancellationReviewModal
        subscription={selectedSubForCancel}
        isOpen={Boolean(selectedSubForCancel)}
        onClose={() => setSelectedSubForCancel(null)}
      />

      {/* Price Hike Review Modal */}
      <PriceHikeReviewModal
        subscription={selectedSubForPriceHike}
        isOpen={Boolean(selectedSubForPriceHike)}
        onClose={() => setSelectedSubForPriceHike(null)}
        onOpenCancelModal={(sub) => {
          setSelectedSubForPriceHike(null);
          setSelectedSubForCancel(sub);
        }}
      />

      {/* Annual Arbitrage Grouped Batch Review Modal */}
      <AnnualArbitrageBatchModal
        isOpen={isArbitrageModalOpen}
        candidates={arbitrageCandidates}
        targetCurrency={targetCurrency}
        benchmarkPercent={userBenchmark}
        onClose={() => setIsArbitrageModalOpen(false)}
      />
    </>
  );
}
