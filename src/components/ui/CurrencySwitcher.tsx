'use client';

import React from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils/cn';

const POPULAR_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY'];

export function CurrencySwitcher({ className }: { className?: string }) {
  const { displayCurrency, updateProfile } = useSubscriptions();

  const handleSelect = async (curr: string) => {
    if (curr === displayCurrency) return;
    await updateProfile({ currency_preference: curr });
  };

  return (
    <div
      className={cn(
        'inline-flex items-center p-0.5 rounded-lg bg-surface border border-border text-xs shadow-xs',
        className
      )}
      role="group"
      aria-label="Currency Selector"
    >
      {POPULAR_CURRENCIES.map((curr) => {
        const isSelected = displayCurrency.toUpperCase() === curr;
        return (
          <button
            key={curr}
            type="button"
            onClick={() => handleSelect(curr)}
            className={cn(
              'px-2 py-1 max-md:min-h-[44px] max-md:min-w-[44px] rounded-md font-mono text-[11px] font-medium transition-all cursor-pointer',
              isSelected
                ? 'bg-card text-primary font-bold shadow-xs border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            {curr}
          </button>
        );
      })}
    </div>
  );
}
