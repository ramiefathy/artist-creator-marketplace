'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';

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
      <main>
        <h1>Messages</h1>
        <p style={{ opacity: 0.8 }}>Threads are created when you submit an offer. Messaging is optional for MVP workflows.</p>

        <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>
        {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

        {threads.length === 0 ? <p>No message threads.</p> : null}

        <ul>
          {threads.map((t) => (
            <li key={t.threadId} style={{ marginBottom: 10 }}>
              <Link href={`/messages/${t.threadId}`}>{t.threadId}</Link>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Campaign: {t.campaignId} | Contract: {t.contractId ?? '—'}</div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>{t.lastMessageAt}</div>
            </li>
          ))}
        </ul>
      </main>
    </RequireVerified>
  );
}
