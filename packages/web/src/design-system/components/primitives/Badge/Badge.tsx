'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Badge.module.css';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

export function Badge({ variant = 'neutral', size = 'sm', className, ...props }: BadgeProps) {
  return <span className={cn(styles.badge, styles[variant], styles[size], className)} {...props} />;
}

