'use client';

import React, { useState } from 'react';
import { Subscription } from '@/lib/types';
import { SubscriptionCard } from './SubscriptionCard';
import { Button, ButtonLink } from '../ui/Button';
import { Search, Plus, Layers, Sparkles, UploadCloud, RotateCcw } from 'lucide-react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils/cn';

interface SubscriptionListProps {
  subscriptions: Subscription[];
  onToggleStatus?: (id: string, currentStatus: string) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function SubscriptionList({
  subscriptions,
  onToggleStatus,
  onDelete,
  isLoading: propLoading,
}: SubscriptionListProps) {
  const { categories, populateStarterTemplates, isLoading: contextLoading } = useSubscriptions();
  const isLoading = propLoading !== undefined ? propLoading : contextLoading;
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'trials' | 'candidates' | 'paused'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'next_renewal_date' | 'amount' | 'name'>('next_renewal_date');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('focusSearch') === 'true') {
        const input = document.getElementById('subscription-search-input') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      }
    }
  }, []);

  const handleResetFilters = () => {
    setSearch('');
    setActiveTab('all');
    setCategoryFilter('all');
    setSortBy('next_renewal_date');
  };

  const filtered = subscriptions.filter((sub) => {
    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const matchName = sub.name.toLowerCase().includes(q);
      const matchDesc = sub.description?.toLowerCase().includes(q);
      const matchCat = sub.category?.name.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchCat) return false;
    }
    if (activeTab === 'active' && sub.status !== 'active') return false;
    if (activeTab === 'trials' && (!sub.is_trial || sub.status !== 'active')) return false;
    if (activeTab === 'candidates' && (sub.value_rating !== 'cancel_candidate' || sub.status !== 'active')) return false;
    if (activeTab === 'paused' && sub.status !== 'paused') return false;
    if (categoryFilter !== 'all' && sub.category_id !== categoryFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'next_renewal_date') {
      return new Date(a.next_renewal_date).getTime() - new Date(b.next_renewal_date).getTime();
    }
    if (sortBy === 'amount') return b.amount - a.amount;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  // 1. Loading skeleton state (prevent empty flash)
  if (isLoading && subscriptions.length === 0) {
    return (
      <div className="paper-sheet">
        <div className="paper ledger-paper py-10" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-8 px-[var(--ledger-pad)] py-3.5">
              <div className="h-9 w-[52px] sweep-skeleton" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 sweep-skeleton" />
                <div className="h-3 w-24 sweep-skeleton" />
              </div>
              <div className="h-4 w-14 sweep-skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Empty ledger state (only when truly empty and done loading)
  if (!isLoading && subscriptions.length === 0) {
    return (
      <div className="sweep-card p-8 sm:p-10 text-center space-y-4 border-dashed">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-surface flex items-center justify-center text-primary shadow-xs">
          <Layers className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">
            No subscriptions yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Add the apps and services you pay for, or import a bank statement to find them for you.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <ButtonLink href="/subscriptions/new" variant="primary" size="md" className="w-full sm:w-auto gap-1.5 shadow-xs">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add a subscription
          </ButtonLink>
          <ButtonLink href="/subscriptions/import" variant="outline" size="md" className="w-full sm:w-auto gap-1.5">
            <UploadCloud className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            Import statement
          </ButtonLink>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => populateStarterTemplates()}
            className="w-full sm:w-auto gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            Try with sample data
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'all', label: 'All', count: subscriptions.length },
    { id: 'active', label: 'Active', count: subscriptions.filter((s) => s.status === 'active').length },
    { id: 'trials', label: 'Trials', count: subscriptions.filter((s) => s.is_trial && s.status === 'active').length },
    { id: 'candidates', label: 'To cancel', count: subscriptions.filter((s) => s.value_rating === 'cancel_candidate' && s.status === 'active').length },
    { id: 'paused', label: 'Paused', count: subscriptions.filter((s) => s.status === 'paused').length },
  ];

  return (
    <div className="paper-sheet">
      <div className="paper ledger-paper pt-9 pb-8">
        {/* Search and filters */}
        <div className="px-[var(--ledger-pad)] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              id="subscription-search-input"
              type="text"
              placeholder="Search by name or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sweep-input pl-9 pr-8"
              aria-label="Search subscriptions"
            />
            <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center justify-center text-[10px] font-mono text-muted-foreground bg-surface border border-border rounded px-1.5 py-0.5 pointer-events-none">
              /
            </kbd>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="sweep-input text-xs py-2 px-3"
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="sweep-input text-xs py-2 px-3"
              aria-label="Sort order"
            >
              <option value="next_renewal_date">Sort: next renewal</option>
              <option value="amount">Sort: cost, high to low</option>
              <option value="name">Sort: name</option>
            </select>
          </div>
        </div>

        {/* Status tabs */}
        <div className="mt-2 mb-1 px-[calc(var(--ledger-pad)-0.625rem)] flex items-center overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter by status">
          {tabs
            .filter((tab) => tab.id === 'all' || tab.count > 0 || activeTab === tab.id)
            .map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'relative inline-flex items-center gap-1 min-h-[44px] px-2.5 font-mono text-xs uppercase tracking-[0.06em] whitespace-nowrap cursor-pointer transition-colors',
                activeTab === tab.id
                  ? 'text-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              )}
            >
              <span>{tab.label}</span>
              <span className="tabular-nums font-normal">{tab.count}</span>
              {activeTab === tab.id ? (
                <span aria-hidden="true" className="absolute left-2.5 right-2.5 bottom-1.5 h-[2px] bg-danger" />
              ) : null}
            </button>
          ))}
        </div>

        {sorted.length > 0 ? (
          <>
            <div className="mx-[var(--ledger-pad)] flex pb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground border-b-[1.5px] border-foreground">
              <span className="w-[52px]">Due</span>
              <span className="flex-1 pl-[30px]">Name</span>
              <span>Amount</span>
            </div>
            <div className="ledger-rows">
              {sorted.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </>
        ) : (
          /* Filter zero-state */
          <div className="px-[var(--ledger-pad)] py-10 text-center space-y-3">
            <h3 className="font-serif text-lg">Nothing matches</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {search.trim()
                ? `No subscription found for "${search}".`
                : 'No subscription fits the current category or status filter.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={handleResetFilters} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset filters
              </Button>
              <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add subscription
              </ButtonLink>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
