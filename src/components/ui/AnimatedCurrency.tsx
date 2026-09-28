'use client';

import React, { useEffect, useState, useRef } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';

interface AnimatedCurrencyProps {
  value: number;
  currency: string;
  className?: string;
  duration?: number;
  showCents?: boolean;
}

export function AnimatedCurrency({
  value,
  currency,
  className,
  duration = 180,
  showCents = true,
}: AnimatedCurrencyProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevValueRef = useRef(value);
  const prevCurrencyRef = useRef(currency);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const currencyChanged = prevCurrencyRef.current !== currency;

    if (
      prefersReducedMotion ||
      currencyChanged ||
      (prevValueRef.current === value && prevCurrencyRef.current === currency)
    ) {
      setDisplayValue(value);
      prevValueRef.current = value;
      prevCurrencyRef.current = currency;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = value;
    const startTime = performance.now();

    setIsTransitioning(true);

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsTransitioning(false);
        prevValueRef.current = endValue;
        prevCurrencyRef.current = currency;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, currency, duration]);

  return (
    <span
      className={cn(
        'inline-block font-mono tabular-nums transition-opacity duration-150',
        isTransitioning ? 'opacity-85' : 'opacity-100',
        className
      )}
    >
      {formatCurrency(displayValue, currency, { showCents })}
    </span>
  );
}
