'use client';

import React, { useState } from 'react';
import { Button, ButtonLink } from '../ui/Button';
import { SweepLogo } from '../brand/SweepLogo';
import { useSubscriptions } from '@/context/SubscriptionContext';
import { ArrowRight, Sparkles, UploadCloud } from 'lucide-react';

interface WelcomeScreenProps {
  onRestoreClick?: () => void;
}

export function WelcomeScreen({ onRestoreClick }: WelcomeScreenProps) {
  const { populateStarterTemplates } = useSubscriptions();
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  const handleTrySample = async () => {
    setIsLoadingSample(true);
    try {
      await populateStarterTemplates();
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex flex-col items-center justify-center text-center px-4 py-8 sm:py-12 max-w-sm mx-auto animate-in fade-in duration-300">
      {/* Sweep Wordmark & Icon */}
      <div className="flex flex-col items-center mb-2">
        <SweepLogo variant="icon" size="lg" className="mb-4 shadow-sm" />
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-foreground">
          Sweep
        </h1>
      </div>

      {/* Supporting Line */}
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-8 font-normal leading-relaxed">
        Keep track of everything you pay for each month, and get a reminder before it renews.
      </p>

      {/* Three ways to start, so import and sample data are easy to find */}
      <div className="w-full space-y-2.5">
        <ButtonLink
          href="/subscriptions/new"
          variant="primary"
          size="lg"
          className="w-full justify-center text-sm font-medium shadow-xs py-2.5 gap-2"
        >
          Add your first subscription
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </ButtonLink>

        <ButtonLink
          href="/subscriptions/import"
          variant="outline"
          size="lg"
          className="w-full justify-center text-sm font-medium py-2.5 gap-2"
        >
          <UploadCloud className="w-4 h-4 text-primary" aria-hidden="true" />
          Import a bank statement
        </ButtonLink>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleTrySample}
          isLoading={isLoadingSample}
          className="w-full justify-center text-xs gap-1.5 py-2"
        >
          {!isLoadingSample ? <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" /> : null}
          Try it with sample data
        </Button>

        {onRestoreClick ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRestoreClick}
            className="w-full justify-center text-xs text-muted-foreground hover:text-foreground font-normal py-2"
          >
            Restore a backup
          </Button>
        ) : (
          <ButtonLink
            href="/settings#restore"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs text-muted-foreground hover:text-foreground font-normal py-2"
          >
            Restore a backup
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
