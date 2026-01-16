'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/design-system/utils';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, loading && styles.loading, className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
        <span className={loading ? styles.hiddenText : undefined}>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';

