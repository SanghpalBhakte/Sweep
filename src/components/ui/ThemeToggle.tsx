'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function ThemeToggle({
  showLabels = false,
  variant = 'segmented',
}: {
  showLabels?: boolean;
  variant?: 'segmented' | 'cycle';
}) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'paper-ledger', icon: Sun, label: 'Light', title: 'Light theme' },
    { value: 'night-shelf', icon: Moon, label: 'Dark', title: 'Dark theme' },
    { value: 'system', icon: Laptop, label: 'Auto', title: 'Match my device' },
  ] as const;

  if (variant === 'cycle') {
    const currentIndex = options.findIndex((o) => o.value === theme);
    const current = options[currentIndex === -1 ? 0 : currentIndex];
    const CurrentIcon = current.icon;

    return (
      <button
        type="button"
        onClick={() => {
          const nextIndex = (Math.max(currentIndex, 0) + 1) % options.length;
          setTheme(options[nextIndex].value);
        }}
        title={`Theme: ${current.label}. Tap to switch.`}
        className="relative p-2 max-md:min-h-[44px] max-md:min-w-[44px] text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors cursor-pointer flex items-center justify-center"
        aria-label={`Change theme, currently ${current.label}`}
      >
        <CurrentIcon className="w-4 h-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center p-0.5 bg-surface border border-border rounded-lg"
      role="group"
      aria-label="Color theme"
    >
      {options.map(({ value, icon: Icon, label, title }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          title={title}
          aria-pressed={theme === value}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 max-md:min-h-[44px] max-md:min-w-[44px] justify-center text-xs font-medium rounded-md transition-colors duration-fast cursor-pointer',
            theme === value
              ? 'bg-card text-foreground shadow-xs border border-border'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {showLabels ? <span>{label}</span> : null}
        </button>
      ))}
    </div>
  );
}
