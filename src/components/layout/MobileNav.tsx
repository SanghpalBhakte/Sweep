'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CreditCard, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useSubscriptions } from '@/context/SubscriptionContext';

export function MobileNav() {
  const pathname = usePathname();
  const { stats } = useSubscriptions();

  // 4 primary single-word tabs for smooth mobile navigation
  const navItems = [
    {
      href: '/',
      label: 'Home',
      icon: LayoutDashboard,
      active: pathname === '/',
    },
    {
      href: '/subscriptions',
      label: 'Subscriptions',
      icon: CreditCard,
      active: pathname.startsWith('/subscriptions') && pathname !== '/subscriptions/new',
      badge: stats.upcomingRenewalsCount > 0 ? stats.upcomingRenewalsCount : undefined,
    },
    {
      href: '/insights',
      label: 'Insights',
      icon: PieChart,
      active: pathname === '/insights',
    },
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      active: pathname.startsWith('/settings'),
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border px-1.5 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
      <nav
        className="flex items-center justify-around max-w-md mx-auto"
        aria-label="Mobile navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center min-h-[44px] min-w-[48px] px-2 py-1 rounded-xl text-[10px] font-medium transition-all duration-instant relative',
                item.active
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground active:scale-[0.98]'
              )}
            >
              <div className="relative mb-0.5">
                <Icon className="w-5 h-5" aria-hidden="true" />
                {item.badge ? (
                  <span
                    className="absolute -top-1 -right-2 min-w-[14px] h-[14px] bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1 tabular-nums shadow-xs"
                    aria-label={`${item.badge} upcoming renewals`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {item.active ? (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-primary" />
              ) : null}
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
