'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Repeat, PieChart, Settings, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useSubscriptions } from '@/context/SubscriptionContext';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
};

export function MobileNav() {
  const pathname = usePathname();
  const { stats } = useSubscriptions();

  const navItems: NavItem[] = [
    { href: '/home', label: 'Home', icon: Home, active: pathname === '/home' },
    {
      href: '/subscriptions',
      label: 'Subscriptions',
      icon: Repeat,
      active: pathname.startsWith('/subscriptions') && pathname !== '/subscriptions/new',
      badge: stats.upcomingRenewalsCount > 0 ? stats.upcomingRenewalsCount : undefined,
    },
    { href: '/insights', label: 'Insights', icon: PieChart, active: pathname === '/insights' },
    { href: '/settings', label: 'Settings', icon: Settings, active: pathname.startsWith('/settings') },
  ];

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border pb-[env(safe-area-inset-bottom,0px)]">
      <nav className="grid grid-cols-4 max-w-md mx-auto" aria-label="Main">
        {navItems.map(({ href, label, icon: Icon, active, badge }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex flex-col items-center justify-center gap-1 pt-2 pb-2.5 min-h-[56px] text-[11px] leading-none transition-colors',
              active ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'
            )}
          >
            {/* Pill behind the icon marks the current tab (same idea as Android and iOS) */}
            <span
              className={cn(
                'relative flex items-center justify-center w-14 h-7 rounded-full transition-colors',
                active ? 'bg-foreground/10' : 'group-active:bg-foreground/5'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
              {badge ? (
                <span className="absolute top-0 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-danger-foreground text-[10px] font-bold leading-4 text-center tabular-nums">
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </span>
            <span className="truncate max-w-full px-1">{label}</span>
            {badge ? <span className="sr-only">, {badge} renewing soon</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
