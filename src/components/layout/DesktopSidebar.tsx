'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  PieChart,
  Settings,
  Plus,
  User,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import { SweepLogo } from '@/components/brand/SweepLogo';
import { AnimatedCurrency } from '@/components/ui/AnimatedCurrency';

// Keep in sync with the init script in app/layout.tsx
const COLLAPSED_KEY = 'sweep_sidebar_collapsed';

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  // The init script already set the attribute before paint; mirror it into state.
  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute('data-sidebar') === 'collapsed');
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const root = document.documentElement;
      if (next) root.setAttribute('data-sidebar', 'collapsed');
      else root.removeAttribute('data-sidebar');
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // "[" folds and unfolds the sidebar, like most desktop apps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { collapsed, toggle };
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const { stats, profile } = useSubscriptions();
  const { user, isConfigured } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();

  const navItems = [
    {
      href: '/home',
      label: 'Overview',
      icon: LayoutDashboard,
      active: pathname === '/home',
    },
    {
      href: '/subscriptions',
      label: 'Subscriptions',
      icon: CreditCard,
      active: pathname.startsWith('/subscriptions') && pathname !== '/subscriptions/new',
      count: stats.activeCount,
    },
    {
      href: '/insights',
      label: 'Insights & spend',
      icon: PieChart,
      active: pathname === '/insights',
      count: stats.cancelCandidateCount > 0 ? stats.cancelCandidateCount : undefined,
      countVariant: 'alert' as const,
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      active: pathname.startsWith('/settings'),
    },
  ];

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)';
  // Folding only animates the width and fades labels. Icons sit in a fixed 64px
  // column (12px gutter + 12px padding + 16px icon), so nothing jumps sideways.
  const fade = 'whitespace-nowrap transition-opacity duration-[180ms] collapsed:opacity-0';

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 collapsed:w-16 border-r border-border h-screen sticky top-0 bg-surface/30 shrink-0 z-20 select-none overflow-hidden transition-[width] duration-[280ms] ease-standard">
      {/* Brand */}
      <div className="h-13 sm:h-14 px-3.5 border-b border-border/50 flex items-center shrink-0">
        <Link href="/home" className="flex items-center gap-2.5" aria-label="Sweep home">
          <SweepLogo variant="icon" size="sm" />
          <SweepLogo variant="wordmark" size="sm" className={fade} />
        </Link>
      </div>

      {/* Add */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/subscriptions/new"
          title="Add subscription (N)"
          aria-label="Add subscription"
          className="w-full sweep-btn sweep-btn-primary text-xs py-2 px-3 justify-start gap-2 shadow-xs group overflow-hidden"
        >
          <Plus className="w-4 h-4 shrink-0 transition-transform group-hover:rotate-90" aria-hidden="true" />
          <span className={cn('flex-1 text-left font-medium', fade)}>Add subscription</span>
          <kbd className={cn('text-[11px] bg-primary-foreground/20 border border-primary-foreground/20 rounded px-1.5 font-mono font-normal', fade)}>
            N
          </kbd>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        <div className={cn('text-xs font-medium text-muted-foreground px-3 py-1.5', fade)}>Workspace</div>

        <nav className="space-y-0.5" aria-label="Primary desktop navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors group cursor-pointer border border-transparent overflow-hidden',
                  item.active
                    ? 'bg-card text-foreground shadow-2xs border-border/50 font-semibold'
                    : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    item.active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                  aria-hidden="true"
                />
                <span className={cn('flex-1 truncate', fade)}>{item.label}</span>

                {item.count !== undefined ? (
                  <span
                    className={cn(
                      'text-[11px] tabular-nums font-mono px-1.5 rounded-md',
                      fade,
                      item.countVariant === 'alert'
                        ? 'bg-danger/12 text-danger font-semibold'
                        : item.active
                        ? 'bg-surface text-foreground'
                        : 'text-muted-foreground bg-surface/50'
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
                {item.countVariant === 'alert' && item.count !== undefined ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 left-[26px] w-1.5 h-1.5 rounded-full bg-danger opacity-0 collapsed:opacity-100 transition-opacity duration-[180ms]"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Snapshot, account, fold */}
      <div className="px-3 pt-3 pb-3 border-t border-border/50">
        <div className="grid grid-rows-[1fr] collapsed:grid-rows-[0fr] transition-[grid-template-rows] duration-[280ms] ease-standard">
          <div className="overflow-hidden min-h-0">
            <div className={cn('mb-3 p-3 rounded-xl bg-card border border-border/50 shadow-2xs space-y-2 min-w-[208px]', fade)}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">You pay per month</span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  <AnimatedCurrency
                    value={stats.monthlyTotal}
                    currency={profile?.currency_preference || 'USD'}
                  />
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1.5 border-t border-border/40">
                <span>{stats.activeCount} active</span>
                {stats.trialCount > 0 ? (
                  <span className="text-warning flex items-center gap-1 text-xs font-medium">
                    <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                    {stats.trialCount} trial{stats.trialCount > 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Signed-in account links to Settings, where sign out lives (no accidental sign outs here) */}
        <Link
          href={user || !isConfigured ? '/settings' : '/login'}
          title={user ? `${user.email}: account settings` : isConfigured ? 'Sign in' : 'Settings'}
          className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-lg hover:bg-surface/70 transition-colors overflow-hidden"
        >
          <span className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground shrink-0">
            <User className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', fade)}>
            {user ? user.email : 'Not signed in'}
          </span>
          {!user && isConfigured ? (
            <span className={cn('text-xs text-primary font-medium', fade)}>Sign in</span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="mt-1 w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-surface/70 transition-colors cursor-pointer overflow-hidden"
        >
          <ToggleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className={cn('flex-1 text-left', fade)}>Collapse</span>
          <kbd className={cn('text-[11px] font-mono px-1.5 rounded border border-border/60', fade)}>[</kbd>
        </button>
      </div>
    </aside>
  );
}
