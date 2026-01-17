'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { Card, Heading, Section, Stack, Text } from '@/design-system';

export default function AdminDashboard() {
  const { user, loading, role } = useAuth();
  const [pendingCreators, setPendingCreators] = useState<any[]>([]);

  async function refresh() {
    const snaps = await getDocs(query(collection(db, 'creatorProfiles'), where('verificationStatus', '==', 'pending')));
    setPendingCreators(snaps.docs.map((d) => d.data() as any));
  }

  useEffect(() => {
    // Avoid noisy "Missing or insufficient permissions" errors caused by querying before auth/claims are ready.
    if (loading || !user || role !== 'admin') return;
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid, role]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Admin dashboard</Heading>
              <Text color="muted">
                <Link href="/admin/disputes">View disputes</Link> · <Link href="/admin/reports">Reports</Link> · <Link href="/notifications">Notifications</Link>
              </Text>
            </Stack>

            <Card>
              <Stack gap={3}>
                <Heading level={2}>Creators pending verification</Heading>
                {pendingCreators.length ? (
                  <ul>
                    {pendingCreators.map((c) => (
                      <li key={c.uid}>
                        <Link href={`/admin/creators/${c.uid}`}>{c.displayName}</Link> · <Text as="span" color="muted">{c.uid}</Text>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Text color="muted">No creators are currently pending verification.</Text>
                )}
              </Stack>
            </Card>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
