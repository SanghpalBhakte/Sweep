'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { DesktopSidebar } from './DesktopSidebar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Dynamically import non-critical modals and client managers to reduce critical First Load JS
const AddSubscriptionModal = dynamic(
  () => import('../subscriptions/AddSubscriptionModal').then((m) => m.AddSubscriptionModal),
  { ssr: false }
);

const ServiceWorkerManager = dynamic(
  () => import('@/components/pwa/ServiceWorkerManager').then((m) => m.ServiceWorkerManager),
  { ssr: false }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useKeyboardShortcuts({
    onOpenAddModal: () => setIsAddModalOpen(true),
    isModalOpen: isAddModalOpen,
  });

  return (
    <div className="h-screen w-full flex flex-row bg-background text-foreground overflow-hidden">
      {/* 1. Pinned Desktop Sidebar (scrolls independently only if viewport is too short) */}
      <DesktopSidebar />

      {/* 2. Primary Single Vertical Scroll Region for the Application Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden bg-background">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-12 min-w-0">
          {children}
        </main>
      </div>

      {/* 3. Mobile Navigation Bottom Bar */}
      <MobileNav />

      {/* Mobile "Add" lives in the sticky header. The old floating + button duplicated it
          and covered the last row of content. */}

      {/* 5. Global Quick Add Subscription Modal (keyboard shortcut "N") */}
      {isAddModalOpen && (
        <AddSubscriptionModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* 6. Non-intrusive PWA update notification banner */}
      <ServiceWorkerManager />
    </div>
  );
}
