'use client';

import React from 'react';
import { Label, Text } from '@/design-system/components/typography';
import styles from './Field.module.css';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, required, helpText, error, children }: FieldProps) {
  return (
    <div className={styles.field}>
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

