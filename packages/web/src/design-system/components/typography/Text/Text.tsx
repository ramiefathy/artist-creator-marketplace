'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Text.module.css';

export type TextSize = 'sm' | 'md' | 'lg';
export type TextColor = 'default' | 'muted' | 'subtle' | 'error';
export type TextWhitespace = 'normal' | 'preWrap';

export type TextProps = {
  as?: 'p' | 'span' | 'div';
  size?: TextSize;
  color?: TextColor;
  whitespace?: TextWhitespace;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function Text({
  as: Component = 'p',
  size = 'md',
  color = 'default',
  whitespace = 'normal',
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Component className={cn(styles.text, styles[size], styles[color], whitespace === 'preWrap' && styles.preWrap, className)} {...props}>
      {children}
    </Component>
  );
}
