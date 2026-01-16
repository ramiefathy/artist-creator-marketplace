'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn(styles.card, className)} {...props}>
      {children}
    </div>
  );
}

