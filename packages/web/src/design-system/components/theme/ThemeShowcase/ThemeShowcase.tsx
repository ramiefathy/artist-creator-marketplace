'use client';

import React, { useMemo, useState } from 'react';
import { useTheme, type ThemeType } from '@/design-system/providers';
import { cn } from '@/design-system/utils';
import { Button } from '@/design-system/components/primitives';
import styles from './ThemeShowcase.module.css';

type ThemeCard = {
  id: ThemeType;
  label: string;
  description: string;
  swatches: string[];
};

export function ThemeShowcase() {
  const { theme, setTheme, previewTheme, setPreviewTheme } = useTheme();
  const [pendingSelect, setPendingSelect] = useState<ThemeType | null>(null);

  const cards = useMemo<ThemeCard[]>(
    () => [
      { id: 'noir', label: 'NOIR', description: 'Dark & electric', swatches: ['#0a0a0f', '#00f0ff', '#ff00ff'] },
      { id: 'analog', label: 'ANALOG', description: 'Warm & nostalgic', swatches: ['#faf6f1', '#d4582a', '#1a5f4a'] },
      { id: 'luma', label: 'LUMA', description: 'Clean & premium', swatches: ['#ffffff', '#0f1729', '#6366f1'] },
      { id: 'flux', label: 'FLUX', description: 'Bold & expressive', swatches: ['#f5f0e8', '#ff3d00', '#1400ff'] }
    ],
    []
  );

  function preview(id: ThemeType) {
    setPendingSelect(null);
    setPreviewTheme(id);
  }

  function clearPreview() {
    setPendingSelect(null);
    setPreviewTheme(null);
  }

  const active = previewTheme ?? theme;

  return (
    <div className={styles.grid}>
      {cards.map((c) => {
        const isActive = c.id === active;
        const isSelected = c.id === theme;
        const isPending = pendingSelect === c.id;

        return (
          <div
            key={c.id}
            className={cn(styles.card, isActive && styles.active, isSelected && styles.selected)}
            onMouseEnter={() => preview(c.id)}
            onMouseLeave={() => clearPreview()}
          >
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>{c.label}</div>
                {isSelected ? <div className={styles.selectedBadge}>Selected</div> : null}
              </div>
              <div className={styles.cardDesc}>{c.description}</div>
            </div>

            <div className={styles.swatches} aria-hidden="true">
              {c.swatches.map((hex) => (
                <div key={hex} className={styles.swatch} style={{ backgroundColor: hex }} />
              ))}
            </div>

            <div className={styles.actions}>
              <Button
                variant={isSelected ? 'secondary' : 'primary'}
                size="sm"
                fullWidth
                onClick={async () => {
                  // Mobile-friendly: first tap previews, second tap confirms.
                  if (previewTheme !== c.id && theme !== c.id) {
                    preview(c.id);
                    setPendingSelect(c.id);
                    return;
                  }
                  await setTheme(c.id);
                  clearPreview();
                }}
              >
                {isSelected ? 'Current' : isPending ? `Select ${c.label}` : 'Preview'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

