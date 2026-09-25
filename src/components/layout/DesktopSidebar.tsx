'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  PieChart,
  Settings,
  Plus,
  Sparkles,
  LogOut,
  User,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { useAuth } from '@/context/AuthContext';
import { SweepLogo } from '@/components/brand/SweepLogo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AnimatedCurrency } from '@/components/ui/AnimatedCurrency';

export function DesktopSidebar() {
  const pathname = usePathname();
  const { stats, profile } = useSubscriptions();
  const { user, signOut, isConfigured } = useAuth();

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
      label: 'Insights & Spend',
      icon: PieChart,
      active: pathname === '/insights',
      count: stats.cancelCandidateCount > 0 ? stats.cancelCandidateCount : undefined,
      countVariant: 'alert' as const,
    },
    {
      href: '/settings',
      label: 'Settings & Theme',
      icon: Settings,
      active: pathname === '/settings',
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-68 border-r border-border h-screen sticky top-0 bg-surface/30 shrink-0 z-20 select-none">
      {/* 1. Brand & Workspace Header */}
      <div className="p-4 lg:p-5 border-b border-border/70 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group" aria-label="Sweep home">
          <SweepLogo size="sm" />
        </Link>
        <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-md bg-surface text-muted-foreground border border-border/60">
          v1.0
        </span>
      </div>

      {/* 2. Quick Action CTA */}
      <div className="px-3.5 pt-3 pb-1">
        <Link
          href="/subscriptions/new"
          className="w-full sweep-btn sweep-btn-primary text-xs py-2 px-3 justify-between shadow-xs group"
        >
          <span className="flex items-center gap-2 font-medium">
            <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" aria-hidden="true" />
            <span>Add Subscription</span>
          </span>
          <kbd className="text-[9px] bg-primary-foreground/20 border border-primary-foreground/20 rounded px-1.5 py-0.2 font-mono font-normal">
            N
          </kbd>
        </Link>
      </div>

      {/* 3. Primary Navigation */}
      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        <div className="text-xs font-medium text-muted-foreground px-2.5 py-1">
          Workspace
        </div>

        <nav className="space-y-0.5" aria-label="Primary desktop navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer',
                  item.active
                    ? 'bg-card text-foreground shadow-2xs border border-border/50 font-semibold'
                    : 'text-muted-foreground hover:bg-surface/70 hover:text-foreground'
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      item.active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.count !== undefined ? (
                  <span
                    className={cn(
                      'text-[11px] tabular-nums font-mono px-1.5 py-0.2 rounded-md',
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
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 4. Quick Monthly Snapshot & Intelligence */}
      <div className="p-3.5 border-t border-border/50 space-y-3">
        <div className="p-3 rounded-xl bg-card border border-border/50 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              You pay per month
            </span>
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
                <ShieldAlert className="w-3 h-3" />
                {stats.trialCount} trial{stats.trialCount > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        </div>

        {/* 5. User Account & Controls Footer */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground shrink-0">
              <User className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate max-w-[100px] lg:max-w-[120px]">
                {user ? user.email : 'Not signed in'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            {user ? (
              <button
                type="button"
                onClick={() => signOut()}
                title={`Sign out (${user.email})`}
                className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger-subtle/30 rounded-lg transition-colors cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            ) : isConfigured ? (
              <Link
                href="/login"
                className="text-[11px] text-primary font-medium hover:underline px-1.5"
              >
                Sign In
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
