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

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_COOKIE = 'mcmp-theme-v1';
const DEFAULT_THEME: ThemeType = 'luma';
const VALID_THEMES: ThemeType[] = ['noir', 'analog', 'luma', 'flux'];

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  initialTheme?: ThemeType;
};

export function ThemeProvider({ children, initialTheme = DEFAULT_THEME }: ThemeProviderProps) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeType>(initialTheme);
  const [previewTheme, setPreviewTheme] = useState<ThemeType | null>(null);

  const activeTheme = previewTheme ?? theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [activeTheme]);

  // Load persisted theme when the user becomes available. This enables cross-device persistence.
  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    (async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const fromDb = snap.exists() ? (snap.data() as any).theme : undefined;
      if (!VALID_THEMES.includes(fromDb as ThemeType)) return;

      if (!cancelled && fromDb !== theme) {
        setThemeState(fromDb as ThemeType);
        setCookie(THEME_COOKIE, fromDb as string, 365);
      }
    })().catch((error) => {
      console.error('Failed to load theme preference:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, theme]);

  const setTheme = useCallback(
    async (newTheme: ThemeType) => {
      if (!VALID_THEMES.includes(newTheme)) return;

      setThemeState(newTheme);
      setPreviewTheme(null);
      setCookie(THEME_COOKIE, newTheme, 365);

      if (!user?.uid) return;
      try {
        await callSetThemePreference({ theme: newTheme });
      } catch (error) {
        // Cookie already set, so user experience is fine even if this fails.
        console.error('Failed to save theme preference:', error);
      }
    },
    [user?.uid]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      previewTheme,
      setPreviewTheme
    }),
    [previewTheme, setTheme, theme]
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

