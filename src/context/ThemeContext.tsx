'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'paper-ledger' | 'night-shelf' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'paper-ledger' | 'night-shelf';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'sweep_theme_preference';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'paper-ledger' | 'night-shelf'>('paper-ledger');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(THEME_STORAGE_KEY) ||
        localStorage.getItem('sift_theme_preference')) as Theme | null;
      if (stored && (stored === 'paper-ledger' || stored === 'night-shelf' || stored === 'system')) {
        setThemeState(stored);
      }
    } catch {
      // Ignore
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const root = document.documentElement;
      let effectiveTheme: 'paper-ledger' | 'night-shelf' = 'paper-ledger';

      if (theme === 'system') {
        effectiveTheme = mediaQuery.matches ? 'night-shelf' : 'paper-ledger';
      } else {
        effectiveTheme = theme;
      }

      setResolvedTheme(effectiveTheme);

      if (effectiveTheme === 'night-shelf') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'night-shelf');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'paper-ledger');
      }

      // Phone status bar follows the theme the user picked, not only the system setting
      const barColor = effectiveTheme === 'night-shelf' ? '#0F0B0A' : '#D9D2C4';
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.removeAttribute('media');
        m.setAttribute('content', barColor);
      });
    };

    applyTheme();

    const listener = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    const next = resolvedTheme === 'paper-ledger' ? 'night-shelf' : 'paper-ledger';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
