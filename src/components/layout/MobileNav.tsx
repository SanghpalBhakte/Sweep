'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useSubscriptions } from '@/context/SubscriptionContext';

export function MobileNav() {
  const pathname = usePathname();
  const { stats } = useSubscriptions();

  const navItems = [
    { href: '/', label: 'Overview', active: pathname === '/' },
    {
      href: '/subscriptions',
      label: 'Subscriptions',
      active: pathname.startsWith('/subscriptions') && pathname !== '/subscriptions/new',
      badge: stats.upcomingRenewalsCount > 0 ? stats.upcomingRenewalsCount : undefined,
    },
    { href: '/insights', label: 'Insights', active: pathname === '/insights' },
    { href: '/settings', label: 'Settings', active: pathname.startsWith('/settings') },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-lg border-t border-foreground/25 px-1 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
      <nav className="flex items-center justify-around max-w-md mx-auto" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'relative flex items-center justify-center min-h-[48px] px-2 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors',
              item.active
                ? 'text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground font-medium'
            )}
          >
            <span className="relative">
              {item.href === '/subscriptions' ? (
                <>
                  <span aria-hidden="true" className="min-[360px]:hidden">Subs</span>
                  <span className="max-[359px]:sr-only">Subscriptions</span>
                </>
              ) : (
                item.label
              )}
              {item.badge ? (
                <span
                  className="absolute -top-2 -right-3 min-w-[14px] text-[11px] font-bold text-danger tabular-nums"
                  aria-label={`${item.badge} upcoming renewals`}
                >
                  {item.badge}
                </span>
              ) : null}
            </span>
            {item.active ? (
              <span aria-hidden="true" className="absolute left-2 right-2 bottom-2 h-[2px] bg-danger" />
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
