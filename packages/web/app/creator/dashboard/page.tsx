'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callCreatorSyncStripeOnboardingStatus } from '@/lib/callables';
import { Badge, ButtonLink, DataTable, Heading, Section, Stack, Text } from '@/design-system';

type Campaign = {
  campaignId: string;
  title: string;
  pricing: { maxPricePerDeliverableCents: number };
};

export default function CreatorDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
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
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load campaigns'));
    refreshStripeStatus().catch(() => undefined);
  }, []);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Creator dashboard</Heading>
              <Stack gap={2}>
                <div>
                  <ButtonLink href="/creator/profile" variant="secondary" size="sm">
                    Edit profile
                  </ButtonLink>{' '}
                  <ButtonLink href="/creator/contracts" variant="secondary" size="sm">
                    View contracts
                  </ButtonLink>{' '}
                  <ButtonLink href="/creator/offers" variant="secondary" size="sm">
                    My offers
                  </ButtonLink>{' '}
                  <ButtonLink href="/notifications" variant="secondary" size="sm">
                    Notifications
                  </ButtonLink>
                </div>

                <Text color="muted">
                  Stripe Connect status:{' '}
                  <Badge variant={stripeStatus === 'active' ? 'success' : stripeStatus ? 'info' : 'neutral'}>{stripeStatus ?? 'unknown'}</Badge>{' '}
                  · <Link href="/creator/stripe">Manage</Link> · <Link href="/creator/verification">Request verification</Link>
                </Text>
              </Stack>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            <Stack gap={2}>
              <Heading level={2}>Live campaigns</Heading>
              <DataTable<Campaign>
                caption="Campaigns currently accepting offers."
                columns={[
                  {
                    key: 'title',
                    header: 'Campaign',
                    cell: (c) => <Link href={`/creator/campaigns/${c.campaignId}`}>{c.title}</Link>
                  },
                  {
                    key: 'maxPrice',
                    header: 'Max price / deliverable',
                    align: 'right',
                    cell: (c) => <Text as="span" color="muted">${(c.pricing.maxPricePerDeliverableCents / 100).toFixed(2)}</Text>
                  }
                ]}
                data={campaigns}
                getRowKey={(c) => c.campaignId}
                emptyState={<Text color="muted">No live campaigns available.</Text>}
              />
            </Stack>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
