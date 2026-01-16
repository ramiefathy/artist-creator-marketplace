'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callSubmitOffer, callGetTrackPreviewUrl } from '@/lib/callables';
import { Button, ButtonLink, Card, Field, Heading, Input, Section, Stack, Text, Textarea, useToast } from '@/design-system';

export default function CreatorCampaignPage({ params }: { params: { id: string } }) {
  const campaignId = params.id;
  const { pushToast } = useToast();
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
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Campaign</Heading>
              <ButtonLink href="/creator/dashboard" variant="secondary" size="sm">
                ← Back to dashboard
              </ButtonLink>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}
            {!campaign ? <Text color="muted">Not found.</Text> : null}

            {campaign ? (
              <Stack gap={4}>
                <Card>
                  <Stack gap={2}>
                    <Heading level={2}>{campaign.title}</Heading>
                    <Text color="muted">{campaign.brief}</Text>
                    <Text size="sm" color="muted">
                      Max price: ${(campaign.pricing.maxPricePerDeliverableCents / 100).toFixed(2)}
                    </Text>
                    <div>
                      <Button
                        variant="secondary"
                        size="sm"
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
                      </Button>
                    </div>
                  </Stack>
                </Card>

                <Card>
                  <Stack
                    as="form"
                    gap={4}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setErrMsg(null);
                      try {
                        await callSubmitOffer({ campaignId, priceCents, message: message || null });
                        pushToast({ title: 'Offer submitted', variant: 'success' });
                      } catch (e: any) {
                        setErrMsg(e?.message ?? 'Failed');
                      }
                    }}
                  >
                    <Heading level={2}>Submit offer</Heading>

                    <Field label="Price (cents)" htmlFor="priceCents" required helpText={`$${(priceCents / 100).toFixed(2)}`}>
                      <Input
                        id="priceCents"
                        type="number"
                        min={500}
                        max={500000}
                        value={priceCents}
                        onChange={(e) => setPriceCents(parseInt(e.target.value, 10))}
                        required
                      />
                    </Field>

                    <Field label="Message (optional)" htmlFor="message">
                      <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                    </Field>

                    <div>
                      <Button type="submit">Submit offer</Button>
                    </div>
                  </Stack>
                </Card>
              </Stack>
            ) : null}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
