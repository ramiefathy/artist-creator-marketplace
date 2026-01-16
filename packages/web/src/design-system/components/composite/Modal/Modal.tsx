'use client';

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/design-system/utils';
import styles from './Modal.module.css';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  title?: string;
  description?: string;
  size?: ModalSize;
  closeLabel?: string;
  closeOnOverlayClick?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  open,
  title,
  description,
  size = 'md',
  closeLabel = 'Close dialog',
  closeOnOverlayClick = true,
  onClose,
  children,
  footer
}: ModalProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const ariaProps = useMemo(() => {
    if (title) return { 'aria-labelledby': titleId };
    return { 'aria-label': 'Dialog' };
  }, [title, titleId]);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the dialog or first focusable element.
    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusable(dialog);
      (focusable[0] ?? dialog).focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusable(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (!closeOnOverlayClick) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={cn(styles.dialog, styles[size])}
        role="dialog"
        aria-modal="true"
        {...ariaProps}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {title || description ? (
          <div className={styles.header}>
            <div>
              {title ? (
                <div className={styles.title} id={titleId}>
                  {title}
                </div>
              ) : null}
              {description ? (
                <div className={styles.description} id={descId}>
                  {description}
                </div>
              ) : null}
            </div>
            <button className={styles.close} onClick={onClose} aria-label={closeLabel} type="button">
              ×
            </button>
          </div>
        ) : null}

        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

function getFocusable(root: HTMLElement) {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  return Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

