'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/design-system/utils';
import styles from './Select.module.css';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ error, className, children, ...props }, ref) => {
  return (
    <select ref={ref} className={cn(styles.select, error && styles.error, className)} {...props}>
      {children}
    </select>
  );
});

Select.displayName = 'Select';

