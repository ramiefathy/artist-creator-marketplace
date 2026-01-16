'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastViewport, type ToastItem, type ToastVariant } from '@/design-system/components/composite';

export type ToastInput = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  pushToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const pushToast = useCallback(
    ({ title, message, variant, durationMs = 5000 }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => {
        const next = [{ id, title, message, variant }, ...prev];
        return next.slice(0, maxToasts);
      });

      if (durationMs > 0) {
        const timer = window.setTimeout(() => {
          dismissToast(id);
        }, durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast, maxToasts]
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
      dismissToast,
      clearToasts
    }),
    [clearToasts, dismissToast, pushToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

