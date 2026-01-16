'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callPublishCampaign, callAcceptOffer, callRejectOffer } from '@/lib/callables';
import { Button, Card, Heading, Inline, Section, Stack, Text, useToast } from '@/design-system';

export default function ArtistCampaignPage({ params }: { params: { id: string } }) {
  const campaignId = params.id;
  const { pushToast } = useToast();

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
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Campaign</Heading>
              <Text>
                <Link href="/artist/dashboard">← Back</Link>
              </Text>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {!campaign ? <Text>Not found.</Text> : null}

            {campaign ? (
              <Stack gap={6}>
                <Card data-flux-zone="tables">
                  <Stack gap={2}>
                    <Heading level={2} size="_2xl">
                      {campaign.title}
                    </Heading>
                    <Text>Status: {campaign.status}</Text>
                    <Text>Track: {campaign.trackId}</Text>
                    {campaign.status === 'draft' ? (
                      <div>
                        <Button
                          onClick={async () => {
                            setErrMsg(null);
                            try {
                              await callPublishCampaign({ campaignId });
                              await refresh();
                              pushToast({ title: 'Campaign published', variant: 'success' });
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            }
                          }}
                        >
                          Publish campaign
                        </Button>
                      </div>
                    ) : null}
                  </Stack>
                </Card>

                <Stack gap={3} as="section" data-flux-zone="tables">
                  <Heading level={2} size="_2xl">
                    Offers
                  </Heading>
                  {offers.length === 0 ? <Text color="muted">No offers yet.</Text> : null}
                  {offers.length > 0 ? (
                    <Stack gap={3}>
                      {offers.map((o) => (
                        <Card key={o.offerId}>
                          <Stack gap={3}>
                            <Stack gap={1}>
                              <Text>
                                <strong>{o.creatorUid}</strong> — ${Number(o.priceCents / 100).toFixed(2)} — {o.status}
                              </Text>
                              {o.message ? (
                                <Text size="sm" color="muted">
                                  Message: {o.message}
                                </Text>
                              ) : null}
                            </Stack>

                            {o.status === 'submitted' ? (
                              <Inline gap={3} wrap>
                                <Button
                                  disabled={busyId === o.offerId}
                                  onClick={async () => {
                                    setBusyId(o.offerId);
                                    setErrMsg(null);
                                    try {
                                      const res: any = await callAcceptOffer({ offerId: o.offerId });
                                      const checkoutUrl = (res.data as any)?.checkoutUrl as string | null;
                                      await refresh();
                                      if (checkoutUrl) window.open(checkoutUrl, '_blank');
                                      else pushToast({ title: 'Offer accepted', message: 'Checkout URL not available.', variant: 'info' });
                                    } catch (e: any) {
                                      setErrMsg(e?.message ?? 'Failed');
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Accept &amp; Pay
                                </Button>

                                <Button
                                  disabled={busyId === o.offerId}
                                  variant="secondary"
                                  onClick={async () => {
                                    setBusyId(o.offerId);
                                    setErrMsg(null);
                                    try {
                                      await callRejectOffer({ offerId: o.offerId });
                                      await refresh();
                                      pushToast({ title: 'Offer rejected', variant: 'warning' });
                                    } catch (e: any) {
                                      setErrMsg(e?.message ?? 'Failed');
                                    } finally {
                                      setBusyId(null);
                                    }
                                  }}
                                >
                                  Reject
                                </Button>
                              </Inline>
                            ) : null}
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
