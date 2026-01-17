'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { Button, Card, Heading, Inline, Section, Stack, Text } from '@/design-system';

type ReportDoc = {
  reportId: string;
  status: 'open' | 'resolved' | 'dismissed';
  targetType: 'post' | 'comment' | 'user';
  reporterUid: string;
  targetUid: string | null;
  postId: string | null;
  commentId: string | null;
  reasonCode: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};

export default function AdminReportsPage() {
  const { user, loading, role } = useAuth();
  const [items, setItems] = useState<ReportDoc[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const snaps = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(100)));
    setItems(snaps.docs.map((d) => d.data() as any) as ReportDoc[]);
  }

  useEffect(() => {
    if (loading || !user || role !== 'admin') return;
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load reports'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid, role]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Reports</Heading>
              <Text color="muted">
                <Link href="/admin/dashboard">Admin dashboard</Link> · <Link href="/notifications">Notifications</Link>
              </Text>
            </Stack>

            <Inline gap={3} wrap>
              <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
                Refresh
              </Button>
            </Inline>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            <Card>
              <Stack gap={3}>
                <Heading level={2}>Open reports</Heading>
                {items.length === 0 ? <Text color="muted">No open reports.</Text> : null}
                {items.length > 0 ? (
                  <ul>
                    {items.map((r) => (
                      <li key={r.reportId}>
                        <Link href={`/admin/reports/${r.reportId}`}>{r.targetType}</Link> · <Text as="span" color="muted">{r.reasonCode}</Text> ·{' '}
                        <Text as="span" color="muted">
                          {r.createdAt}
                        </Text>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Stack>
            </Card>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
