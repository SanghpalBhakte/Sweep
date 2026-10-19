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
  LogOut,
  LogIn,
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
  const { user, signOut, isConfigured } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();

  const navItems = [
    {
      href: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      active: pathname === '/',
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

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 collapsed:w-16 lg:collapsed:w-16 border-r border-border h-screen sticky top-0 bg-surface/30 shrink-0 z-20 select-none transition-[width] duration-medium ease-standard">
      {/* Brand + fold button */}
      <div className="h-13 sm:h-14 px-3 lg:px-4 collapsed:px-0 border-b border-border/50 flex items-center justify-between collapsed:justify-center shrink-0">
        <Link href="/" className="flex items-center collapsed:hidden" aria-label="Sweep home">
          <SweepLogo size="sm" />
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
        >
          <ToggleIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Add */}
      <div className="px-3 collapsed:px-0 pt-3 pb-1 flex collapsed:justify-center">
        <Link
          href="/subscriptions/new"
          title="Add subscription (N)"
          aria-label="Add subscription"
          className="w-full collapsed:w-10 collapsed:h-10 collapsed:p-0 collapsed:justify-center sweep-btn sweep-btn-primary text-xs py-2 px-3 justify-between shadow-xs group"
        >
          <span className="flex items-center gap-2 font-medium">
            <Plus className="w-4 h-4 collapsed:w-4.5 collapsed:h-4.5 transition-transform group-hover:rotate-90" aria-hidden="true" />
            <span className="collapsed:hidden">Add subscription</span>
          </span>
          <kbd className="collapsed:hidden text-[11px] bg-primary-foreground/20 border border-primary-foreground/20 rounded px-1.5 font-mono font-normal">
            N
          </kbd>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 collapsed:px-0 py-2">
        <div className="text-xs font-medium text-muted-foreground px-2.5 py-1.5 collapsed:hidden">
          Workspace
        </div>

        <nav className="space-y-0.5 collapsed:space-y-1 collapsed:flex collapsed:flex-col collapsed:items-center" aria-label="Primary desktop navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  'relative flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors group cursor-pointer border border-transparent',
                  'collapsed:w-10 collapsed:h-10 collapsed:p-0 collapsed:justify-center',
                  item.active
                    ? 'bg-card text-foreground shadow-2xs border-border/50 font-semibold'
                    : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      item.active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate collapsed:sr-only">{item.label}</span>
                </span>

                {item.count !== undefined ? (
                  <>
                    <span
                      className={cn(
                        'collapsed:hidden text-[11px] tabular-nums font-mono px-1.5 rounded-md',
                        item.countVariant === 'alert'
                          ? 'bg-danger/12 text-danger font-semibold'
                          : item.active
                          ? 'bg-surface text-foreground'
                          : 'text-muted-foreground bg-surface/50'
                      )}
                    >
                      {item.count}
                    </span>
                    {item.countVariant === 'alert' ? (
                      <span
                        aria-hidden="true"
                        className="hidden collapsed:block absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger"
                      />
                    ) : null}
                  </>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Monthly snapshot + account */}
      <div className="p-3 collapsed:px-0 border-t border-border/50 space-y-3">
        <div className="collapsed:hidden p-3 rounded-xl bg-card border border-border/50 shadow-2xs space-y-2">
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

        <div className="flex items-center justify-between gap-2 collapsed:flex-col collapsed:gap-1">
          <div
            className="flex items-center gap-2 min-w-0"
            title={user ? user.email ?? undefined : 'Not signed in'}
          >
            <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground shrink-0">
              <User className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <p className="collapsed:hidden text-xs font-medium text-foreground truncate">
              {user ? user.email : 'Not signed in'}
            </p>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => signOut()}
              title={`Sign out (${user.email})`}
              className="p-2 shrink-0 text-muted-foreground hover:text-danger hover:bg-danger-subtle/30 rounded-lg transition-colors cursor-pointer"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : isConfigured ? (
            <Link
              href="/login"
              title="Sign in"
              className="shrink-0 flex items-center gap-1.5 text-xs text-primary font-medium hover:underline px-2 py-1.5 collapsed:p-2 rounded-lg"
            >
              <LogIn className="w-4 h-4 hidden collapsed:block" aria-hidden="true" />
              <span className="collapsed:sr-only">Sign in</span>
            </Link>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
