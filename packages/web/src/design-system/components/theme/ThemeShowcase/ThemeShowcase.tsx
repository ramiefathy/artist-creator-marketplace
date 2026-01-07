'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme, type ThemeType } from '@/design-system/providers';
import { Button } from '@/design-system/components/primitives';
import styles from './ThemeShowcase.module.css';

const themes: { id: ThemeType; title: string; description: string }[] = [
  { id: 'noir', title: 'NOIR', description: 'Dark & electric.' },
  { id: 'analog', title: 'ANALOG', description: 'Warm & nostalgic.' },
  { id: 'luma', title: 'LUMA', description: 'Clean & premium.' },
  { id: 'flux', title: 'FLUX', description: 'Bold & expressive.' },
];

export function ThemeShowcase() {
  const { theme, setTheme, previewTheme, setPreviewTheme } = useTheme();
  const [selected, setSelected] = useState<ThemeType>(theme);

  useEffect(() => {
    setSelected(theme);
  }, [theme]);

  const selectedMeta = useMemo(() => themes.find((t) => t.id === selected)!, [selected]);

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={[
              styles.card,
              t.id === selected ? styles.selected : null,
              t.id === (previewTheme ?? theme) ? styles.active : null,
            ]
              .filter(Boolean)
              .join(' ')}
            onMouseEnter={() => setPreviewTheme(t.id)}
            onMouseLeave={() => setPreviewTheme(null)}
            onClick={() => setSelected(t.id)}
          >
            <div className={styles.cardTitle}>{t.title}</div>
            <div className={styles.cardDesc}>{t.description}</div>
            {t.id === theme ? <div className={styles.current}>Current</div> : null}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <Button
          size="md"
          onClick={() => {
            void setTheme(selected);
            setPreviewTheme(null);
          }}
          disabled={selected === theme}
        >
          Use {selectedMeta.title}
        </Button>
        <Button
          size="md"
          variant="secondary"
          onClick={() => {
            setSelected(theme);
            setPreviewTheme(null);
          }}
          disabled={selected === theme && !previewTheme}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

