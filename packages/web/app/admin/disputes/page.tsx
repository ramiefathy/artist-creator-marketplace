'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { Badge, Button, ButtonLink, DataTable, Heading, Section, Stack, Text } from '@/design-system';

type Dispute = {
  disputeId: string;
  contractId: string;
  artistUid: string;
  creatorUid: string;
  status: string;
  reasonCode: string;
  createdAt: string;
};

export default function AdminDisputesPage() {
  const { user, loading, role } = useAuth();
  const [items, setItems] = useState<Dispute[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const snaps = await getDocs(
      query(collection(db, 'disputes'), where('status', 'in', ['open', 'under_review']), orderBy('createdAt', 'desc'), limit(100))
    );
    setItems(snaps.docs.map((d) => d.data() as any) as Dispute[]);
  }

  useEffect(() => {
    if (loading || !user || role !== 'admin') return;
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load disputes'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid, role]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Disputes</Heading>
              <ButtonLink href="/admin/dashboard" variant="secondary" size="sm">
                ← Back to admin dashboard
              </ButtonLink>
            </Stack>

            <Stack gap={3}>
              <div>
                <Button variant="secondary" size="sm" onClick={() => refresh().catch(() => undefined)}>
                  Refresh
                </Button>
              </div>
              {errMsg ? <Text color="error">{errMsg}</Text> : null}

              <DataTable
                caption="Open and under-review disputes."
                columns={[
                  {
                    key: 'disputeId',
                    header: 'Dispute',
                    cell: (d) => <Link href={`/admin/disputes/${d.disputeId}`}>{d.disputeId}</Link>
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    cell: (d) => <Badge variant={d.status === 'open' ? 'warning' : 'info'}>{d.status}</Badge>
                  },
                  {
                    key: 'reasonCode',
                    header: 'Reason',
                    cell: (d) => <Text as="span" color="muted">{d.reasonCode}</Text>
                  },
                  {
                    key: 'contractId',
                    header: 'Contract',
                    cell: (d) => <Text as="span" color="muted">{d.contractId}</Text>
                  },
                  {
                    key: 'createdAt',
                    header: 'Created',
                    cell: (d) => <Text as="span" color="subtle">{d.createdAt}</Text>
                  }
                ]}
                data={items}
                getRowKey={(d) => d.disputeId}
                emptyState={<Text color="muted">No open disputes.</Text>}
              />
            </Stack>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
