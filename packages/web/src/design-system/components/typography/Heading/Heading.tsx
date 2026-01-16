'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Heading.module.css';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '_2xl' | '_3xl' | '_4xl';

export interface HeadingProps {
  level: HeadingLevel;
  size?: HeadingSize;
  className?: string;
  children: React.ReactNode;
}

export function Heading({ level, size, className, children }: HeadingProps) {
  const Tag = `h${level}` as const;
  const sizeClass = size ?? getDefaultSize(level);

  return <Tag className={cn(styles.heading, styles[sizeClass], className)}>{children}</Tag>;
}

function getDefaultSize(level: HeadingLevel): HeadingSize {
  const sizeMap: Record<HeadingLevel, HeadingSize> = {
    1: '_4xl',
    2: '_3xl',
    3: '_2xl',
    4: 'xl',
    5: 'lg',
    6: 'md'
  };
  return sizeMap[level];
}

