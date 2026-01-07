'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';

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
        <main>
          <h1>Creator contracts</h1>
          <p>
            <Link href="/creator/dashboard">← Back to dashboard</Link>
          </p>

          <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

          {items.length === 0 ? <p>No contracts yet.</p> : null}

          <ul>
            {items.map((c) => (
              <li key={c.contractId} style={{ marginBottom: 10 }}>
                <Link href={`/creator/contracts/${c.contractId}`}>{c.contractId}</Link>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Status: {c.status} | Payment: {c.stripe?.paymentStatus ?? 'n/a'} | Total: ${((c.pricing?.totalPriceCents ?? 0) / 100).toFixed(2)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{c.createdAt}</div>
              </li>
            ))}
          </ul>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
