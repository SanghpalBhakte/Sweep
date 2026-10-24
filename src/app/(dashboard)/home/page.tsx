import React, { Suspense } from 'react';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import DashboardLoading from '../loading';

export const revalidate = 60;

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardClient />
    </Suspense>
  );
}
