'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';

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
  const [items, setItems] = useState<Dispute[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const snaps = await getDocs(
      query(collection(db, 'disputes'), where('status', 'in', ['open', 'under_review']), orderBy('createdAt', 'desc'), limit(100))
    );
    setItems(snaps.docs.map((d) => d.data() as any) as Dispute[]);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load disputes'));
  }, []);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <main>
          <h1>Disputes</h1>
          <p>
            <Link href="/admin/dashboard">← Back to admin dashboard</Link>
          </p>

          <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>
          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

          {items.length === 0 ? <p>No open disputes.</p> : null}

          <ul>
            {items.map((d) => (
              <li key={d.disputeId} style={{ marginBottom: 10 }}>
                <Link href={`/admin/disputes/${d.disputeId}`}>{d.disputeId}</Link>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Status: {d.status} | Reason: {d.reasonCode} | Contract: {d.contractId}
                </div>
                <div style={{ fontSize: 12, opacity: 0.6 }}>{d.createdAt}</div>
              </li>
            ))}
          </ul>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
