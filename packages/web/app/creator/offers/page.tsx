'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';

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
        <main>
          <h1>My offers</h1>
          <p>
            <Link href="/creator/dashboard">← Back to dashboard</Link>
          </p>

          <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
          {items.length === 0 ? <p>No offers yet.</p> : null}

          <ul>
            {items.map((o) => (
              <li key={o.offerId} style={{ marginBottom: 10 }}>
                <strong>{o.offerId}</strong>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Status: {o.status} | Price: ${((o.priceCents ?? 0) / 100).toFixed(2)} | Campaign:{' '}
                  <Link href={`/creator/campaigns/${o.campaignId}`}>{o.campaignId}</Link>
                  {' | '}
                  <Link href={`/messages/c_${o.campaignId}_u_${uid}`}>Thread</Link>
                </div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{o.createdAt}</div>
              </li>
            ))}
          </ul>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
