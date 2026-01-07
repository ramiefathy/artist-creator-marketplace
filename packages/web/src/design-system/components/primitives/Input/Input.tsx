'use client';

import React, { forwardRef } from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ error, className, ...props }, ref) => {
  return <input ref={ref} className={[styles.input, error ? styles.error : null, className].filter(Boolean).join(' ')} {...props} />;
});

Input.displayName = 'Input';

