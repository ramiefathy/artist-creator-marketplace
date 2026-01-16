'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import { Label } from '@/design-system/components/typography';
import { Text } from '@/design-system/components/typography';
import styles from './Field.module.css';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, required, helpText, error, className, children }: FieldProps) {
  return (
    <div className={cn(styles.field, className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {helpText && !error ? (
        <Text size="sm" color="muted" className={styles.helpText}>
          {helpText}
        </Text>
      ) : null}
      {error ? (
        <Text size="sm" color="error" className={styles.errorText} role="alert">
          {error}
        </Text>
      ) : null}
    </div>
  );
}

