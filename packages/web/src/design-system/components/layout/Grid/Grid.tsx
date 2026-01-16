'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Grid.module.css';

type SpacingValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: SpacingValue;
  minItemWidth?: number;
  children: React.ReactNode;
}

export function Grid({ gap = 4, minItemWidth = 220, className, children, ...props }: GridProps) {
  return (
    <div
      className={cn(styles.grid, className)}
      style={{ '--grid-gap': `var(--spacing-${gap}, ${gap * 0.25}rem)`, '--grid-min-width': `${minItemWidth}px` } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}

