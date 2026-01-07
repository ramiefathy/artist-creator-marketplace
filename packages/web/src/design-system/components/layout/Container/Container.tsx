'use client';

import React from 'react';
import styles from './Container.module.css';

export interface ContainerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  children: React.ReactNode;
}

const maxWidths: Record<NonNullable<ContainerProps['size']>, string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
};

export function Container({ size = 'lg', className, children }: ContainerProps) {
  return (
    <div
      className={[styles.container, className].filter(Boolean).join(' ')}
      style={{ '--container-max-width': maxWidths[size] } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

