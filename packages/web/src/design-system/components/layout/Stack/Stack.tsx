'use client';

import React from 'react';
import styles from './Stack.module.css';

type SpacingValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

export interface StackProps {
  gap?: SpacingValue;
  align?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article' | 'main' | 'aside' | 'form';
}

export function Stack({ gap = 4, align = 'stretch', className, children, as: Component = 'div' }: StackProps) {
  type Align = NonNullable<StackProps['align']>;
  type NonStretchAlign = Exclude<Align, 'stretch'>;

  const alignItemsMap: Record<NonStretchAlign, React.CSSProperties['alignItems']> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
  };

  return (
    <Component
      className={[styles.stack, className].filter(Boolean).join(' ')}
      style={{
        '--stack-gap': `var(--spacing-${gap}, ${gap * 0.25}rem)`,
        alignItems: align === 'stretch' ? 'stretch' : alignItemsMap[align],
      } as React.CSSProperties}
    >
      {children}
    </Component>
  );
}
