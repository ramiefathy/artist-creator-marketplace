'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callCreatorStartStripeOnboarding, callCreatorRefreshStripeOnboarding, callCreatorSyncStripeOnboardingStatus } from '@/lib/callables';

export default function CreatorStripePage() {
  const [status, setStatus] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const res: any = await callCreatorSyncStripeOnboardingStatus({});
    setStatus((res.data as any)?.status ?? null);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <main>
          <p>
            <Link href="/creator/dashboard">← Back</Link>
          </p>
          <h1>Stripe Connect onboarding</h1>
          <p>Status: {status ?? 'unknown'}</p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={async () => {
                setErrMsg(null);
                try {
                  const res: any = await callCreatorStartStripeOnboarding({});
                  const url = (res.data as any)?.url as string;
                  window.location.href = url;
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed');
                }
              }}
            >
              Start onboarding
            </button>

            <button
              onClick={async () => {
                setErrMsg(null);
                try {
                  const res: any = await callCreatorRefreshStripeOnboarding({});
                  const url = (res.data as any)?.url as string;
                  window.location.href = url;
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed');
                }
              }}
            >
              Refresh onboarding link
            </button>

            <button onClick={() => refresh().catch(() => undefined)}>Refresh status</button>
          </div>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
