'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callPublishCampaign, callAcceptOffer, callRejectOffer } from '@/lib/callables';

export default function ArtistCampaignPage({ params }: { params: { id: string } }) {
  const campaignId = params.id;

  const [campaign, setCampaign] = useState<any | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const cSnap = await getDoc(doc(db, 'campaigns', campaignId));
    setCampaign(cSnap.exists() ? (cSnap.data() as any) : null);

    const offersSnap = await getDocs(query(collection(db, 'offers'), where('campaignId', '==', campaignId)));
    setOffers(offersSnap.docs.map((d) => d.data() as any));
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return (
    <RequireVerified>
      <RequireRole allow={['artist', 'admin']}>
        <main>
          <p>
            <Link href="/artist/dashboard">← Back</Link>
          </p>

          <h1>Campaign</h1>

          {!campaign ? <p>Not found.</p> : null}

          {campaign ? (
            <>
              <p><strong>{campaign.title}</strong></p>
              <p>Status: {campaign.status}</p>
              <p>Track: {campaign.trackId}</p>

              {campaign.status === 'draft' ? (
                <button
                  onClick={async () => {
                    setErrMsg(null);
                    try {
                      await callPublishCampaign({ campaignId });
                      await refresh();
                    } catch (e: any) {
                      setErrMsg(e?.message ?? 'Failed');
                    }
                  }}
                >
                  Publish campaign
                </button>
              ) : null}

              <h2 style={{ marginTop: 24 }}>Offers</h2>
              <ul>
                {offers.map((o) => (
                  <li key={o.offerId} style={{ marginBottom: 12 }}>
                    <div>
                      <strong>{o.creatorUid}</strong> — ${Number(o.priceCents / 100).toFixed(2)} — {o.status}
                    </div>
                    {o.message ? <div style={{ opacity: 0.8 }}>Message: {o.message}</div> : null}

                    {o.status === 'submitted' ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <button
                          disabled={busyId === o.offerId}
                          onClick={async () => {
                            setBusyId(o.offerId);
                            setErrMsg(null);
                            try {
                              const res: any = await callAcceptOffer({ offerId: o.offerId });
                              const checkoutUrl = (res.data as any)?.checkoutUrl as string | null;
                              await refresh();
                              if (checkoutUrl) window.open(checkoutUrl, '_blank');
                              else alert('Offer accepted; checkout URL not available.');
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Accept & Pay
                        </button>

                        <button
                          disabled={busyId === o.offerId}
                          onClick={async () => {
                            setBusyId(o.offerId);
                            setErrMsg(null);
                            try {
                              await callRejectOffer({ offerId: o.offerId });
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
