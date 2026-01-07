'use client';

import React from 'react';
import styles from './Heading.module.css';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type HeadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export interface HeadingProps {
  level: HeadingLevel;
  size?: HeadingSize;
  className?: string;
  children: React.ReactNode;
}

const sizeClassMap: Record<HeadingSize, keyof typeof styles> = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': '_2xl',
  '3xl': '_3xl',
  '4xl': '_4xl',
};

export function Heading({ level, size, className, children }: HeadingProps) {
  const Tag = `h${level}` as const;
  const sizeToken = size ?? getDefaultSize(level);
  const sizeClass = sizeClassMap[sizeToken];

  return <Tag className={[styles.heading, styles[sizeClass], className].filter(Boolean).join(' ')}>{children}</Tag>;
}

function getDefaultSize(level: HeadingLevel): HeadingSize {
  const sizeMap: Record<HeadingLevel, HeadingSize> = {
    1: '3xl',
    2: '2xl',
    3: 'xl',
    4: 'lg',
    5: 'md',
    6: 'sm',
  };
  return sizeMap[level];
}

