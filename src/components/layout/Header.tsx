'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus, Bell, Search, Sparkles } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ButtonLink } from '../ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { SweepLogo } from '../brand/SweepLogo';

// Dynamically import non-critical AlertsSlideOver drawer (only loaded on interaction)
const AlertsSlideOver = dynamic(
  () => import('../reminders/AlertsSlideOver').then((m) => m.AlertsSlideOver),
  { ssr: false }
);

export function Header() {
  const { isConfigured } = useAuth();
  const { totalAlertsCount, urgentAlertsCount, isAlertPanelOpen, toggleAlertPanel } =
    useNotifications();
  const { stats, displayCurrency, profile } = useSubscriptions();

  const targetCurrency = stats.displayCurrency || displayCurrency || 'USD';

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-background/90 backdrop-blur-md border-b border-border/50 transition-colors">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-13 sm:h-14 flex items-center justify-between gap-4">
          {/* Mobile Brand (visible only on mobile where sidebar is hidden) */}
          <div className="flex md:hidden items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2" aria-label="Sweep home">
              <SweepLogo size="sm" />
            </Link>
          </div>

          {/* Desktop Search / Quick Jump Strip */}
          <div className="hidden md:flex items-center gap-3 flex-1 max-w-md">
            <Link
              href="/subscriptions?focusSearch=true"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface/40 hover:bg-surface/70 border border-border/50 text-muted-foreground hover:text-foreground text-xs w-full transition-all group cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
              <span className="flex-1 text-left">Search subscriptions, categories, payment methods…</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-card border border-border/60 text-muted-foreground">
                /
              </kbd>
            </Link>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Currency Badge */}
            <Link
              href="/settings"
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface/40 hover:bg-surface border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              title="Currency preferences in Settings"
            >
              <span className="font-mono font-semibold text-foreground">{targetCurrency}</span>
              <span className="text-[11px]">Ledger</span>
            </Link>

            {/* Reminders Bell with Active Alert Count */}
            <button
              type="button"
              onClick={toggleAlertPanel}
              title={
                totalAlertsCount > 0
                  ? `${totalAlertsCount} upcoming renewals & alerts`
                  : 'Upcoming reminders & alerts'
              }
              className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Alerts and Reminders"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {totalAlertsCount > 0 ? (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                    urgentAlertsCount > 0
                      ? 'bg-danger text-danger-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}
                  aria-label={`${totalAlertsCount} alerts`}
                >
                  {totalAlertsCount}
                </span>
              ) : null}
            </button>

            {/* Mobile Theme Toggle */}
            <div className="md:hidden">
              <ThemeToggle />
            </div>

            {/* Mobile Quick Add Button */}
            <div className="md:hidden">
              <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1 shadow-xs px-2.5 py-1 text-xs">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add</span>
              </ButtonLink>
            </div>
          </div>
        </div>
      </header>

      {/* Slide-over Reminders Drawer (mounted only on demand) */}
      {isAlertPanelOpen && <AlertsSlideOver />}
    </>
  );
}
