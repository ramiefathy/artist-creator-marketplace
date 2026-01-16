'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { Button, Card, Heading, Inline, Section, Stack, Text } from '@/design-system';

type Thread = {
  threadId: string;
  participants: string[];
  campaignId: string;
  offerId: string;
  contractId: string | null;
  lastMessageAt: string;
  createdAt: string;
};

export default function MessagesPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [threads, setThreads] = useState<Thread[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    if (!uid) return;
    const snaps = await getDocs(
      query(collection(db, 'threads'), where('participants', 'array-contains', uid), orderBy('lastMessageAt', 'desc'), limit(50))
    );
    setThreads(snaps.docs.map((d) => d.data() as any) as Thread[]);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load threads'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return (
    <RequireVerified>
      <Section as="section" size="lg">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>Messages</Heading>
            <Text color="muted">Threads are created when you submit an offer. Messaging is optional for MVP workflows.</Text>
          </Stack>

          <Inline gap={3} wrap>
            <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
              Refresh
            </Button>
          </Inline>

          {errMsg ? <Text color="error">{errMsg}</Text> : null}

          {threads.length === 0 ? <Text>No message threads.</Text> : null}

          {threads.length > 0 ? (
            <Stack gap={3} as="section" data-flux-zone="tables">
              {threads.map((t) => (
                <Card key={t.threadId}>
                  <Stack gap={2}>
                    <Link href={`/messages/${t.threadId}`}>{t.threadId}</Link>
                    <Text size="sm" color="muted">
                      Campaign: {t.campaignId} | Contract: {t.contractId ?? '—'}
                    </Text>
                    <Text size="sm" color="subtle">
                      {t.lastMessageAt}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Section>
    </RequireVerified>
  );
}
