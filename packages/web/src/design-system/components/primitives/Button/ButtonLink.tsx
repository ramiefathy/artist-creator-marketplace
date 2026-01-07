'use client';

import React from 'react';
import Link, { type LinkProps } from 'next/link';
import type { ButtonSize, ButtonVariant } from './Button';
import styles from './Button.module.css';

export type ButtonLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  LinkProps & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  };

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={[
        styles.button,
        styles[variant],
        styles[size],
        fullWidth ? styles.fullWidth : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </Link>
  );
}

