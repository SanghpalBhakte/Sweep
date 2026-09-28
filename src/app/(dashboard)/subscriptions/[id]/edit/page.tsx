'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { subscriptionService } from '@/lib/services/subscriptionService';
import { SubscriptionDetailView } from '@/components/subscriptions/SubscriptionDetailView';
import { Subscription, SubscriptionFormData } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AppErrorBoundary } from '@/lib/errors/AppErrorBoundary';
import { SubscriptionScreenErrorFallback } from '@/lib/errors/SubscriptionScreenErrorFallback';

export default function EditSubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const { subscriptions, categories, paymentMethods, updateSubscription, deleteSubscription, isLoading: isContextLoading } =
    useSubscriptions();

  const [directSubscription, setDirectSubscription] = useState<Subscription | null>(null);
  const [isDirectLoading, setIsDirectLoading] = useState(false);

  const contextSubscription = subscriptions.find((s) => s.id === id);
  const subscription = contextSubscription || directSubscription;

  useEffect(() => {
    if (!contextSubscription && id && !isContextLoading) {
      let isMounted = true;
      setIsDirectLoading(true);
      subscriptionService
        .getSubscriptionById(id)
        .then((data) => {
          if (isMounted) {
            setDirectSubscription(data);
          }
        })
        .catch(() => {
          if (isMounted) {
            setDirectSubscription(null);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsDirectLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [contextSubscription, id, isContextLoading]);

  const isLoading = (isContextLoading && !subscription) || isDirectLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-4">
        <div className="h-6 w-32 bg-surface-muted rounded-md animate-pulse" />
        <div className="sweep-card p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="py-16 text-center space-y-3 max-w-md mx-auto">
        <h2 className="text-base font-semibold text-foreground">
          Subscription not found
        </h2>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          The requested item may have been removed or does not exist in your active ledger.
        </p>
        <div className="pt-2">
          <Link
            href="/subscriptions"
            className="tap gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-surface transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to subscriptions
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdate = async (data: SubscriptionFormData) => {
    await updateSubscription(id, data);
  };

  const handleDelete = async (subId: string) => {
    await deleteSubscription(subId);
  };

  return (
    <AppErrorBoundary fallback={<SubscriptionScreenErrorFallback title="Unable to render Subscription Detail" />}>
      <SubscriptionDetailView
        subscription={subscription}
        categories={categories}
        paymentMethods={paymentMethods}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        initialEditMode={true}
      />
    </AppErrorBoundary>
  );
}
