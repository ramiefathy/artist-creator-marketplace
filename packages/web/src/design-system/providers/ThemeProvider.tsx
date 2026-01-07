'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { callSetThemePreference } from '@/lib/callables';

export type ThemeType = 'noir' | 'analog' | 'luma' | 'flux';

type ThemeContextValue = {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => Promise<void>;
  previewTheme: ThemeType | null;
  setPreviewTheme: (theme: ThemeType | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_COOKIE = 'mcmp-theme-v1';
const VALID_THEMES: ThemeType[] = ['noir', 'analog', 'luma', 'flux'];

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  initialTheme: ThemeType;
};

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const { user } = useAuth();

  const [theme, setThemeState] = useState<ThemeType>(initialTheme);
  const [previewTheme, setPreviewTheme] = useState<ThemeType | null>(null);

  // Load Firestore theme on sign-in (cross-device sync)
  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const fromDb = snap.exists() ? (snap.data() as any).theme : undefined;

      if (cancelled) return;
      if (!VALID_THEMES.includes(fromDb as ThemeType)) return;

      setThemeState((prev) => {
        if (prev === fromDb) return prev;
        setCookie(THEME_COOKIE, fromDb as string, 365);
        return fromDb as ThemeType;
      });
      setPreviewTheme(null);
    })().catch((error) => {
      console.error('Failed to load theme preference:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Active theme is preview if set, otherwise confirmed theme
  const activeTheme = previewTheme ?? theme;

  // Update HTML attribute when active theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  const setTheme = useCallback(
    async (newTheme: ThemeType) => {
      if (!VALID_THEMES.includes(newTheme)) return;

      // Update local state immediately
      setThemeState(newTheme);
      setPreviewTheme(null);

      // Persist to cookie
      setCookie(THEME_COOKIE, newTheme, 365);

      // Persist to Firestore via Callable if authenticated (client writes blocked by rules)
      if (user?.uid) {
        try {
          await callSetThemePreference({ theme: newTheme });
        } catch (error) {
          console.error('Failed to save theme preference:', error);
        }
      }
    },
    [user?.uid]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, previewTheme, setPreviewTheme }),
    [theme, setTheme, previewTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

