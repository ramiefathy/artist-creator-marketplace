'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';

export default function AdminDashboard() {
  const [pendingCreators, setPendingCreators] = useState<any[]>([]);

  async function refresh() {
    const snaps = await getDocs(query(collection(db, 'creatorProfiles'), where('verificationStatus', '==', 'pending')));
    setPendingCreators(snaps.docs.map((d) => d.data() as any));
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <main>
          <h1>Admin dashboard</h1>

          <p style={{ opacity: 0.8 }}>
            <Link href="/admin/disputes">View disputes</Link> | <Link href="/notifications">Notifications</Link>
          </p>

          <h2>Creators pending verification</h2>
          <ul>
            {pendingCreators.map((c) => (
              <li key={c.uid}>
                <Link href={`/admin/creators/${c.uid}`}>{c.displayName}</Link> — {c.uid}
              </li>
            ))}
          </ul>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
