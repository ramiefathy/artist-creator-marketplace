'use client';

import React from 'react';
import styles from './Label.module.css';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label className={[styles.label, className].filter(Boolean).join(' ')} {...props}>
      <span className={styles.text}>{children}</span>
      {required ? (
        <span className={styles.requiredMark} aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  );
}

