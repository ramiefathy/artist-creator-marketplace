import React from 'react';
import Link, { type LinkProps } from 'next/link';
import { cn } from '@/design-system/utils';
import type { ButtonSize, ButtonVariant } from './Button';
import styles from './Button.module.css';

export type ButtonLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  };

export function ButtonLink({ variant = 'primary', size = 'md', fullWidth, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className)}
      {...props}
    >
      {children}
    </Link>
  );
}

