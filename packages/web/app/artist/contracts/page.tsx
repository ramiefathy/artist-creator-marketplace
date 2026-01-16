'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { Button, Card, Heading, Inline, Section, Stack, Text } from '@/design-system';

type Contract = {
  contractId: string;
  campaignId: string;
  trackId: string;
  artistUid: string;
  creatorUid: string;
  status: string;
  createdAt: string;
  activatedAt: string | null;
  completedAt: string | null;
  pricing?: { totalPriceCents?: number };
  stripe?: { paymentStatus?: string };
};

export default function ArtistContractsPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [items, setItems] = useState<Contract[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    if (!uid) return;
    const snaps = await getDocs(
      query(collection(db, 'contracts'), where('artistUid', '==', uid), orderBy('createdAt', 'desc'), limit(50))
    );
    const list = snaps.docs.map((d) => d.data() as any) as Contract[];
    setItems(list);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load contracts'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return (
    <RequireVerified>
      <RequireRole allow={['artist', 'admin']}>
        <Section as="section" size="lg">
          <Stack gap={6} data-flux-zone="tables">
            <Stack gap={2}>
              <Heading level={1}>Artist contracts</Heading>
              <Text>
                <Link href="/artist/dashboard">← Back to dashboard</Link>
              </Text>
            </Stack>

            <Inline gap={3} wrap>
              <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
                Refresh
              </Button>
            </Inline>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {items.length === 0 ? <Text>No contracts yet.</Text> : null}

            {items.length > 0 ? (
              <Stack gap={3} as="section">
                {items.map((c) => (
                  <Card key={c.contractId}>
                    <Stack gap={2}>
                      <Link href={`/artist/contracts/${c.contractId}`}>{c.contractId}</Link>
                      <Text size="sm" color="muted">
                        Status: {c.status} | Payment: {c.stripe?.paymentStatus ?? 'n/a'} | Total: $
                        {((c.pricing?.totalPriceCents ?? 0) / 100).toFixed(2)}
                      </Text>
                      <Text size="sm" color="subtle">
                        {c.createdAt}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
