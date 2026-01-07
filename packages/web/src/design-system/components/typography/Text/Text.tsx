'use client';

import React from 'react';
import styles from './Text.module.css';

type TextSize = 'sm' | 'md' | 'lg';
type TextColor = 'default' | 'muted' | 'subtle' | 'error';

type TextOwnProps<TElement extends React.ElementType> = {
  as?: TElement;
  size?: TextSize;
  color?: TextColor;
  className?: string;
  children: React.ReactNode;
};

export type TextProps<TElement extends React.ElementType = 'p'> = TextOwnProps<TElement> &
  Omit<React.ComponentPropsWithoutRef<TElement>, keyof TextOwnProps<TElement>>;

export function Text<TElement extends React.ElementType = 'p'>({
  as,
  size = 'md',
  color = 'default',
  className,
  children,
  ...props
}: TextProps<TElement>) {
  const Component = as ?? 'p';
  return (
    <Component className={[styles.text, styles[size], styles[color], className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  );
}
