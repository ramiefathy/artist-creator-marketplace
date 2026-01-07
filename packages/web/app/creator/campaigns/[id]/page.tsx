'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callSubmitOffer, callGetTrackPreviewUrl } from '@/lib/callables';

export default function CreatorCampaignPage({ params }: { params: { id: string } }) {
  const campaignId = params.id;
  const [campaign, setCampaign] = useState<any | null>(null);
  const [priceCents, setPriceCents] = useState(5000);
  const [message, setMessage] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const cSnap = await getDoc(doc(db, 'campaigns', campaignId));
    setCampaign(cSnap.exists() ? (cSnap.data() as any) : null);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <main>
          <p>
            <Link href="/creator/dashboard">← Back</Link>
          </p>

          <h1>Campaign</h1>
          {!campaign ? <p>Not found.</p> : null}

          {campaign ? (
            <>
              <p><strong>{campaign.title}</strong></p>
              <p>Brief: {campaign.brief}</p>
              <p>Max price: ${(campaign.pricing.maxPricePerDeliverableCents / 100).toFixed(2)}</p>

              <button
                onClick={async () => {
                  setErrMsg(null);
                  try {
                    const res: any = await callGetTrackPreviewUrl({ trackId: campaign.trackId });
                    const url = (res.data as any)?.url as string;
                    window.open(url, '_blank');
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed');
                  }
                }}
              >
                Listen to track preview
              </button>

              <h2 style={{ marginTop: 24 }}>Submit offer</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErrMsg(null);
                  try {
                    await callSubmitOffer({ campaignId, priceCents, message: message || null });
                    alert('Offer submitted.');
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed');
                  }
                }}
              >
                <div>
                  <label>Price (cents)</label>
                  <br />
                  <input type="number" min={500} max={500000} value={priceCents} onChange={(e) => setPriceCents(parseInt(e.target.value, 10))} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <label>Message (optional)</label>
                  <br />
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                </div>

                <button style={{ marginTop: 12 }} type="submit">
                  Submit offer
                </button>
              </form>
            </>
          ) : null}

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
