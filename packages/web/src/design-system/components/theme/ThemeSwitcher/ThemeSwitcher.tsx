'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/design-system/providers';
import { cn } from '@/design-system/utils';
import styles from './ThemeSwitcher.module.css';

type ThemeOption = { id: 'noir' | 'analog' | 'luma' | 'flux'; label: string };

const themes: ThemeOption[] = [
  { id: 'noir', label: 'NOIR' },
  { id: 'analog', label: 'ANALOG' },
  { id: 'luma', label: 'LUMA' },
  { id: 'flux', label: 'FLUX' }
];

export function ThemeSwitcher() {
  const { theme, setTheme, previewTheme, setPreviewTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = themes.find((t) => t.id === theme)!;
  const activeTheme = previewTheme ?? theme;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current || containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
      setPreviewTheme(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      setPreviewTheme(null);
    }

    if (!isOpen) return;
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setPreviewTheme]);

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Current theme: ${currentTheme.label}. Click to change theme.`}
      >
        <span className={styles.triggerLabel}>{currentTheme.label}</span>
      </button>

      {isOpen ? (
        <div className={styles.popover} role="listbox" aria-label="Theme selection">
          <div className={styles.options}>
            {themes.map((t) => (
              <button
                key={t.id}
                className={cn(styles.option, t.id === activeTheme && styles.active)}
                role="option"
                aria-selected={t.id === theme}
                onMouseEnter={() => setPreviewTheme(t.id)}
                onMouseLeave={() => setPreviewTheme(null)}
                onClick={async () => {
                  await setTheme(t.id);
                  setIsOpen(false);
                }}
              >
                <span className={styles.optionLabel}>{t.label}</span>
                {t.id === theme ? <span className={styles.checkmark} aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

