'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme, type ThemeType } from '@/design-system/providers';
import styles from './ThemeSwitcher.module.css';

const themes: { id: ThemeType; label: string; icon: string }[] = [
  { id: 'noir', label: 'NOIR', icon: '🌑' },
  { id: 'analog', label: 'ANALOG', icon: '🎸' },
  { id: 'luma', label: 'LUMA', icon: '✦' },
  { id: 'flux', label: 'FLUX', icon: '⚡' },
];

export function ThemeSwitcher() {
  const { theme, setTheme, previewTheme, setPreviewTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setPreviewTheme(null);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setPreviewTheme]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setPreviewTheme(null);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, setPreviewTheme]);

  const currentTheme = themes.find((t) => t.id === theme);
  const activeTheme = previewTheme ?? theme;

  if (!currentTheme) return null;

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Current theme: ${currentTheme.label}. Click to change theme.`}
      >
        <span className={styles.icon} aria-hidden="true">
          {currentTheme.icon}
        </span>
      </button>

      {isOpen ? (
        <div className={styles.popover} role="listbox" aria-label="Theme selection">
          <div className={styles.header}>
            <span className={styles.title}>Theme</span>
            {previewTheme ? <span className={styles.previewLabel}>Previewing…</span> : null}
          </div>
          <div className={styles.options}>
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className={[styles.option, t.id === activeTheme ? styles.active : null].filter(Boolean).join(' ')}
                role="option"
                aria-selected={t.id === theme}
                onMouseEnter={() => setPreviewTheme(t.id)}
                onMouseLeave={() => setPreviewTheme(null)}
                onClick={() => {
                  void setTheme(t.id);
                  setIsOpen(false);
                }}
              >
                <span className={styles.optionIcon} aria-hidden="true">
                  {t.icon}
                </span>
                <span className={styles.optionLabel}>{t.label}</span>
                {t.id === theme ? (
                  <span className={styles.checkmark} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

