'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus, Bell, Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
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
  const { stats, displayCurrency } = useSubscriptions();

  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'night-shelf';

  const targetCurrency = stats.displayCurrency || displayCurrency || 'USD';

  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-background md:bg-background/90 md:backdrop-blur-md border-b border-border/50 transition-colors">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-13 sm:h-14 flex items-center justify-between gap-4">
          {/* Mobile Brand (visible only on mobile where sidebar is hidden) */}
          <div className="flex md:hidden items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2 min-h-[44px]" aria-label="Sweep home">
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
              <kbd className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-card border border-border/60 text-muted-foreground">
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
              title="Currency preferences in settings"
            >
              <span className="font-mono font-semibold text-foreground">{targetCurrency}</span>
              <span className="text-[11px]">Ledger</span>
            </Link>

            {/* One tap to switch light / dark */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative p-2 max-md:min-h-[44px] max-md:min-w-[44px] text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            >
              {isDark ? (
                <Sun className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />
              )}
            </button>

            {/* Reminders Bell with Active Alert Count */}
            <button
              type="button"
              onClick={toggleAlertPanel}
              title={
                totalAlertsCount > 0
                  ? `${totalAlertsCount} upcoming renewals & alerts`
                  : 'Upcoming reminders & alerts'
              }
              className="relative p-2 max-md:min-h-[44px] max-md:min-w-[44px] text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Alerts and reminders"
            >
              <Bell className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />
              {totalAlertsCount > 0 ? (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[11px] font-bold shadow-xs ${
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

            {/* Theme lives in Settings > Appearance. The extra laptop/sun icon here
                confused people and crowded the phone header. */}

            {/* Mobile Quick Add Button */}
            <div className="md:hidden">
              <ButtonLink href="/subscriptions/new" variant="primary" size="sm" className="gap-1 rounded-full pl-3 pr-4">
                <Plus className="w-4 h-4" aria-hidden="true" />
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
