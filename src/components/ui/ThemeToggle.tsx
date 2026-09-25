'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function ThemeToggle({ showLabels = false }: { showLabels?: boolean }) {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'paper-ledger', icon: Sun, label: 'Light', title: 'Light theme' },
    { value: 'night-shelf', icon: Moon, label: 'Dark', title: 'Dark theme' },
    { value: 'system', icon: Laptop, label: 'Auto', title: 'Match my device' },
  ] as const;

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
            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-fast cursor-pointer',
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
