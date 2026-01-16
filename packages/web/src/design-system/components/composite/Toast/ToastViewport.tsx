'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './ToastViewport.module.css';

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  variant?: ToastVariant;
};

export interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (!toasts.length) return null;

  return (
    <div className={styles.viewport} role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={cn(styles.toast, getVariantClass(t.variant))} role="status" aria-live="polite">
          <div className={styles.title}>{t.title}</div>
          <button className={styles.dismiss} onClick={() => onDismiss(t.id)} aria-label="Dismiss notification" type="button">
            ×
          </button>
          {t.message ? <div className={styles.message}>{t.message}</div> : null}
        </div>
      ))}
    </div>
  );
}

function getVariantClass(variant: ToastVariant | undefined) {
  if (variant === 'success') return styles.variantSuccess;
  if (variant === 'warning') return styles.variantWarning;
  if (variant === 'danger') return styles.variantDanger;
  if (variant === 'info') return styles.variantInfo;
  return undefined;
}

