'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getMediaProxyUrl } from '@/lib/functionsUrl';
import { Text } from '@/design-system';

export type MediaKind = 'image' | 'video' | 'audio';

export function MediaAsset({ assetId, kind, preferDirectUrl }: { assetId: string; kind: MediaKind; preferDirectUrl?: boolean }) {
  const { user } = useAuth();
  const url = useMemo(() => getMediaProxyUrl(assetId), [assetId]);
  const [src, setSrc] = useState<string | null>(() => (preferDirectUrl ? url : null));
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setSrc(preferDirectUrl ? url : null);
    setErrMsg(null);

    (async () => {
      if (preferDirectUrl) {
        if (!cancelled) setSrc(url);
        return;
      }

      if (!user) {
        // Public posts can be accessed without a token.
        if (!cancelled) setSrc(url);
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Media request failed (${res.status})`);
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (!cancelled) setSrc(objectUrl);
    })().catch((e: any) => {
      if (!cancelled) setErrMsg(e?.message ?? 'Failed to load media');
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preferDirectUrl, url, user]);

  if (errMsg) return <Text color="muted">Media unavailable</Text>;
  if (!src) return <Text color="muted">Loading media…</Text>;

  if (kind === 'image') {
    return <img src={src} alt="" style={{ maxWidth: '100%', borderRadius: 12 }} />;
  }
  if (kind === 'video') {
    return <video src={src} controls style={{ width: '100%', borderRadius: 12 }} />;
  }
  return <audio src={src} controls style={{ width: '100%' }} />;
}
