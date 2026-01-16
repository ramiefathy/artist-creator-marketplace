'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Inline.module.css';

type SpacingValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

export interface InlineProps extends React.HTMLAttributes<HTMLElement> {
  gap?: SpacingValue;
  align?: 'start' | 'center' | 'end' | 'stretch';
  wrap?: boolean;
  as?: 'div' | 'section' | 'article' | 'main' | 'aside' | 'form' | 'nav';
}

const alignItemsMap: Record<NonNullable<InlineProps['align']>, React.CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch'
};

export function Inline({ gap = 3, align = 'center', wrap, className, children, as: Component = 'div', ...props }: InlineProps) {
  return (
    <Component
      className={cn(styles.inline, wrap && styles.wrap, className)}
      style={{ '--inline-gap': `var(--spacing-${gap}, ${gap * 0.25}rem)`, alignItems: alignItemsMap[align] } as React.CSSProperties}
      {...(props as any)}
    >
      {children}
    </Component>
  );
}
