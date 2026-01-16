'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/design-system/utils';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ error, className, ...props }, ref) => {
  return <input ref={ref} className={cn(styles.input, error && styles.error, className)} {...props} />;
});

Input.displayName = 'Input';

