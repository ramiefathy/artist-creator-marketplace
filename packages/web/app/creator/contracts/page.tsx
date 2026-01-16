'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Button, ButtonLink, DataTable, Heading, Section, Stack, Text } from '@/design-system';

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

export default function CreatorContractsPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [items, setItems] = useState<Contract[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    if (!uid) return;
    const snaps = await getDocs(
      query(collection(db, 'contracts'), where('creatorUid', '==', uid), orderBy('createdAt', 'desc'), limit(50))
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
      <RequireRole allow={['creator', 'admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Creator contracts</Heading>
              <ButtonLink href="/creator/dashboard" variant="secondary" size="sm">
                ← Back to dashboard
              </ButtonLink>
            </Stack>

            <Stack gap={3}>
              <div>
                <Button variant="secondary" size="sm" onClick={() => refresh().catch(() => undefined)}>
                  Refresh
                </Button>
              </div>

              {errMsg ? <Text color="error">{errMsg}</Text> : null}

              <DataTable<Contract>
                caption="Your most recent contracts."
                columns={[
                  {
                    key: 'contractId',
                    header: 'Contract',
                    cell: (c) => <Link href={`/creator/contracts/${c.contractId}`}>{c.contractId}</Link>
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (c) => <Badge variant={c.status === 'completed' ? 'success' : c.status === 'active' ? 'info' : 'neutral'}>{c.status}</Badge>
                  },
                  {
                    key: 'payment',
                    header: 'Payment',
                    cell: (c) => <Text as="span" color="muted">{c.stripe?.paymentStatus ?? 'n/a'}</Text>
                  },
                  {
                    key: 'total',
                    header: 'Total',
                    align: 'right',
                    cell: (c) => <Text as="span" color="muted">${((c.pricing?.totalPriceCents ?? 0) / 100).toFixed(2)}</Text>
                  },
                  {
                    key: 'createdAt',
                    header: 'Created',
                    cell: (c) => <Text as="span" color="subtle">{c.createdAt}</Text>
                  }
                ]}
                data={items}
                getRowKey={(c) => c.contractId}
                emptyState={<Text color="muted">No contracts yet.</Text>}
              />
            </Stack>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
