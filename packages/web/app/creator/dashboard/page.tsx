'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callCreatorSyncStripeOnboardingStatus } from '@/lib/callables';

export default function CreatorDashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);

  async function refresh() {
    const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), where('status', '==', 'live')));
    setCampaigns(campaignsSnap.docs.map((d) => d.data() as any));
  }

  async function refreshStripeStatus() {
    try {
      const res: any = await callCreatorSyncStripeOnboardingStatus({});
      setStripeStatus((res.data as any)?.status ?? null);
    } catch {
      setStripeStatus(null);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    refreshStripeStatus().catch(() => undefined);
  }, []);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <main>
          <h1>Creator dashboard</h1>

          <p style={{ opacity: 0.8 }}>
            <Link href="/creator/profile">Edit profile</Link> | <Link href="/creator/contracts">View contracts</Link> |{' '}
            <Link href="/creator/offers">My offers</Link> | <Link href="/notifications">Notifications</Link>
          </p>

          <p>
            Stripe Connect status: <strong>{stripeStatus ?? 'unknown'}</strong> — <Link href="/creator/stripe">Manage</Link> —{' '}
            <Link href="/creator/verification">Request verification</Link>
          </p>

          <h2>Live campaigns</h2>
          <ul>
            {campaigns.map((c) => (
              <li key={c.campaignId} style={{ marginBottom: 16 }}>
                <div>
                  <Link href={`/creator/campaigns/${c.campaignId}`}>{c.title}</Link> — max $
                  {(c.pricing.maxPricePerDeliverableCents / 100).toFixed(2)}
                </div>
              </li>
            ))}
          </ul>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
