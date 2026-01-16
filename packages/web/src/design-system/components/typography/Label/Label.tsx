'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Label.module.css';

export type LabelProps = {
  required?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label className={cn(styles.label, className)} {...props}>
      <span className={styles.text}>{children}</span>
      {required ? <span className={styles.required} aria-hidden="true">*</span> : null}
    </label>
  );
}

