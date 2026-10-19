'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme, type Theme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils/cn';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'paper-ledger', label: 'Light', icon: Sun },
  { value: 'night-shelf', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Laptop },
];

// The app's only theme control: one icon in the top bar, three choices in a small menu.
export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const CurrentIcon = resolvedTheme === 'night-shelf' ? Moon : Sun;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Theme"
        title="Theme"
        className="relative p-2 max-md:min-h-[44px] max-md:min-w-[44px] text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors cursor-pointer flex items-center justify-center"
      >
        <CurrentIcon className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute right-0 top-full mt-1.5 w-44 p-1 rounded-xl bg-popover text-popover-foreground border border-border shadow-popover z-50 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 min-h-[36px] max-md:min-h-[44px] rounded-lg text-sm cursor-pointer transition-colors',
                theme === value ? 'text-foreground bg-surface' : 'text-muted-foreground hover:text-foreground hover:bg-surface/70'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {theme === value ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
