'use client';

import React from 'react';
import { cn } from '@/design-system/utils';
import styles from './Avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string | null;
  size?: AvatarSize;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const initials = `${first}${last}`.trim();
  return initials || '?';
}

export function Avatar({ src, alt, name, size = 'md', className, ...props }: AvatarProps) {
  const fallback = name ? getInitials(name) : '?';

  return (
    <div className={cn(styles.avatar, styles[size], className)} {...props}>
      {src ? <img className={styles.img} src={src} alt={alt ?? name ?? 'Avatar'} /> : <span className={styles.fallback}>{fallback}</span>}
    </div>
  );
}

