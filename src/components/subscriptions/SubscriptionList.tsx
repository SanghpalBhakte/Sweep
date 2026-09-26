'use client';

import React, { useState } from 'react';
import { Subscription } from '@/lib/types';
import { SubscriptionCard } from './SubscriptionCard';
import { Button, ButtonLink } from '../ui/Button';
import { Search, Plus, Layers, Sparkles, UploadCloud, RotateCcw } from 'lucide-react';
import { useSubscriptions } from '@/context/SubscriptionContext';

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
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="skeleton sweep-card"
            style={{ height: '78px', borderRadius: '12px' }}
          />
        ))}
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

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              id="subscription-search-input"
              type="text"
              placeholder="Search subscriptions, tools, categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sweep-input pl-9 pr-8"
              aria-label="Search subscriptions"
            />
            <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center justify-center text-[10px] font-mono text-muted-foreground bg-surface border border-border rounded px-1.5 py-0.5 pointer-events-none">
              /
            </kbd>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="sweep-input text-xs py-2 px-3 w-auto min-w-[130px]"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="sweep-input text-xs py-2 px-3 w-auto min-w-[130px]"
              aria-label="Sort order"
            >
              <option value="next_renewal_date">Sort: Next Renewal</option>
              <option value="amount">Sort: Cost (High–Low)</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="relative -mx-1 sm:mx-0">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 px-1 sm:px-0 no-scrollbar" role="tablist" aria-label="Filter by status">
          {[
            { id: 'all', label: 'All', count: subscriptions.length },
            { id: 'active', label: 'Active', count: subscriptions.filter((s) => s.status === 'active').length },
            { id: 'trials', label: 'Trials', count: subscriptions.filter((s) => s.is_trial && s.status === 'active').length },
            { id: 'candidates', label: 'Cancel Candidates', count: subscriptions.filter((s) => s.value_rating === 'cancel_candidate' && s.status === 'active').length },
            { id: 'paused', label: 'Paused', count: subscriptions.filter((s) => s.status === 'paused').length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-card text-foreground border border-border shadow-xs'
                  : 'text-muted-foreground hover:bg-surface hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] px-1 rounded bg-surface-muted text-muted-foreground tabular-nums">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-background to-transparent sm:hidden"
          aria-hidden="true"
        />
        </div>
      </div>

      {/* Subscription Cards */}
      {sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        /* Filter zero-state */
        <div className="sweep-card p-8 sm:p-10 text-center space-y-3 border-dashed">
          <div className="w-10 h-10 mx-auto rounded-full bg-surface flex items-center justify-center text-muted-foreground">
            <Search className="w-5 h-5 opacity-60" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              No subscriptions match your filter
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              {search.trim()
                ? `No active services found for "${search}".`
                : 'No services match the current category or status filter.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset Filters
            </Button>
            <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add Subscription
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
