'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/design-system/utils';
import styles from './Textarea.module.css';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ error, className, ...props }, ref) => {
  return <textarea ref={ref} className={cn(styles.textarea, error && styles.error, className)} {...props} />;
});

Textarea.displayName = 'Textarea';

