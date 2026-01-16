'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Stack.module.css';

type SpacingValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

export interface StackProps extends React.HTMLAttributes<HTMLElement> {
  gap?: SpacingValue;
  align?: 'start' | 'center' | 'end' | 'stretch';
  as?: 'div' | 'section' | 'article' | 'main' | 'aside' | 'form';
}

const alignItemsMap: Record<NonNullable<StackProps['align']>, React.CSSProperties['alignItems']> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch'
};

export function Stack({ gap = 4, align = 'stretch', className, children, as: Component = 'div', ...props }: StackProps) {
  return (
    <Component
      className={cn(styles.stack, className)}
      style={{ '--stack-gap': `var(--spacing-${gap}, ${gap * 0.25}rem)`, alignItems: alignItemsMap[align] } as React.CSSProperties}
      {...(props as any)}
    >
      {children}
    </Component>
  );
}
