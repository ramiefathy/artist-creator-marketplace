'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { Badge, Button, ButtonLink, DataTable, Heading, Section, Stack, Text } from '@/design-system';

type Offer = {
  offerId: string;
  campaignId: string;
  artistUid: string;
  creatorUid: string;
  priceCents: number;
  status: string;
  createdAt: string;
};

export default function CreatorOffersPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [items, setItems] = useState<Offer[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    if (!uid) return;
    const snaps = await getDocs(
      query(collection(db, 'offers'), where('creatorUid', '==', uid), orderBy('createdAt', 'desc'), limit(100))
    );
    setItems(snaps.docs.map((d) => d.data() as any) as Offer[]);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load offers'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>My offers</Heading>
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

              <DataTable<Offer>
                caption="Your most recent offers."
                columns={[
                  {
                    key: 'offerId',
                    header: 'Offer',
                    cell: (o) => <Text as="span">{o.offerId}</Text>
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (o) => <Badge variant={o.status === 'accepted' ? 'success' : o.status === 'rejected' ? 'danger' : 'neutral'}>{o.status}</Badge>
                  },
                  {
                    key: 'price',
                    header: 'Price',
                    align: 'right',
                    cell: (o) => <Text as="span" color="muted">${((o.priceCents ?? 0) / 100).toFixed(2)}</Text>
                  },
                  {
                    key: 'campaign',
                    header: 'Campaign',
                    cell: (o) => <Link href={`/creator/campaigns/${o.campaignId}`}>{o.campaignId}</Link>
                  },
                  {
                    key: 'thread',
                    header: 'Thread',
                    cell: (o) => <Link href={`/messages/c_${o.campaignId}_u_${uid}`}>Open</Link>
                  },
                  {
                    key: 'createdAt',
                    header: 'Created',
                    cell: (o) => <Text as="span" color="subtle">{o.createdAt}</Text>
                  }
                ]}
                data={items}
                getRowKey={(o) => o.offerId}
                emptyState={<Text color="muted">No offers yet.</Text>}
              />
            </Stack>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
