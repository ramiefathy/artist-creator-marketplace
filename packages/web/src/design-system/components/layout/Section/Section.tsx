'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import { Container, type ContainerProps } from '@/design-system/components/layout/Container/Container';
import styles from './Section.module.css';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'main' | 'section' | 'article';
  size?: NonNullable<ContainerProps['size']>;
  children: React.ReactNode;
}

export function Section({ as: Component = 'section', size = 'lg', className, children, ...props }: SectionProps) {
  return (
    <Component className={cn(styles.section, className)} {...props}>
      <Container size={size}>{children}</Container>
    </Component>
  );
}

