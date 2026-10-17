'use client';

import React from 'react';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm';
import { SubscriptionFormData } from '@/lib/types';
import { AppErrorBoundary } from '@/lib/errors/AppErrorBoundary';
import { SubscriptionScreenErrorFallback } from '@/lib/errors/SubscriptionScreenErrorFallback';

export default function NewSubscriptionPage() {
  const { categories, paymentMethods, addSubscription } = useSubscriptions();

  const handleSubmit = async (data: SubscriptionFormData) => {
    await addSubscription(data);
  };

  return (
    <AppErrorBoundary fallback={<SubscriptionScreenErrorFallback title="Unable to open new subscription" />}>
      <div className="py-2">
        <SubscriptionForm
          categories={categories}
          paymentMethods={paymentMethods}
          onSubmit={handleSubmit}
        />
      </div>
    </AppErrorBoundary>
  );
}
