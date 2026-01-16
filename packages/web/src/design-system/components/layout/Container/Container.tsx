'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Container.module.css';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const maxWidths: Record<NonNullable<ContainerProps['size']>, string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%'
};

export function Container({ size = 'lg', className, children, ...props }: ContainerProps) {
  return (
    <div
      className={cn(styles.container, className)}
      style={{ '--container-max-width': maxWidths[size] } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  );
}
