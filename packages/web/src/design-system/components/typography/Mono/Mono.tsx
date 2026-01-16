'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Mono.module.css';

export type MonoSize = 'sm' | 'md';

export interface MonoProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'code' | 'pre' | 'span' | 'div';
  block?: boolean;
  size?: MonoSize;
}

export function Mono({ as = 'code', block, size = 'sm', className, ...props }: MonoProps) {
  const Tag = as as any;
  const isBlock = block ?? as === 'pre';
  return <Tag className={cn(styles.mono, isBlock ? styles.block : styles.inline, styles[size], className)} {...props} />;
}

