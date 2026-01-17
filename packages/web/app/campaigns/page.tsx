import React from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { ButtonLink } from '@/design-system/components/primitives';
import styles from './Campaigns.module.css';

type PublicCampaign = {
  campaignId: string;
  status: 'live' | 'paused' | 'completed' | 'archived' | string;
  title: string;
  brief: string;
  platforms: string[];
  deliverableSpec: { deliverablesTotal: number; deliverableType: string; dueDaysAfterActivation: number; postMustRemainLiveDays?: number };
  pricing: { currency: string; maxPricePerDeliverableCents: number };
  artist: { uid: string; handle: string; displayName: string; roleLabel?: string };
  track: { trackId: string; title: string; artistName: string; genre?: string };
  createdAt: string;
};

function fmtMoney(cents: number, currency: string): string {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  const curr = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
}

export default async function CampaignsPage() {
  const snaps = await getDocs(
    query(collection(publicDb, 'publicCampaigns'), where('status', '==', 'live'), orderBy('createdAt', 'desc'), limit(24))
  );
  const campaigns = snaps.docs.map((d) => d.data() as any as PublicCampaign);

  return (
    <Container size="lg">
      <Section as="section" size="lg">
        <Stack gap={6}>
          <div className={styles.pageIntro}>
            <Stack gap={2}>
              <Heading level={1}>Campaigns</Heading>
              <Text color="muted">
                Public campaigns you can share, browse, and reference. To submit offers, create an account and complete creator onboarding.
              </Text>
            </Stack>
            <div>
              <ButtonLink href="/signup" variant="primary" size="lg">
                Become a creator
              </ButtonLink>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <Text color="muted">No public campaigns are live yet.</Text>
          ) : (
            <div className={styles.grid}>
              {campaigns.map((c) => (
                <article key={c.campaignId} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <Stack gap={1}>
                      <Heading level={2} size="xl">
                        <Link className={styles.titleLink} href={`/c/${c.campaignId}`}>
                          {c.title}
                        </Link>
                      </Heading>
                      <Text color="muted">
                        by{' '}
                        {c.artist?.handle ? (
                          <Link href={`/u/${c.artist.handle}`}>@{c.artist.handle}</Link>
                        ) : (
                          <span>{c.artist?.displayName ?? 'Artist'}</span>
                        )}{' '}
                        · Track: <span>{c.track?.title ?? 'Untitled'}</span>
                      </Text>
                    </Stack>
                  </div>

                  <div className={styles.metaRow}>
                    <span className={styles.pill}>Max: {fmtMoney(c.pricing?.maxPricePerDeliverableCents ?? 0, c.pricing?.currency ?? 'USD')}</span>
                    <span className={styles.pill}>Deliverables: {Number(c.deliverableSpec?.deliverablesTotal ?? 0) || 0}</span>
                    <span className={styles.pill}>Platform: {Array.isArray(c.platforms) && c.platforms.length > 0 ? c.platforms[0] : '—'}</span>
                    <span className={styles.pill}>Due: {Number(c.deliverableSpec?.dueDaysAfterActivation ?? 0) || 0} days</span>
                  </div>

                  <Stack gap={2} style={{ marginTop: 'var(--spacing-4)' }}>
                    <Text>
                      {String(c.brief ?? '')
                        .trim()
                        .slice(0, 220)}
                      {String(c.brief ?? '').trim().length > 220 ? '…' : ''}
                    </Text>
                    <Text color="muted" size="sm">
                      Open campaign page → <Link href={`/c/${c.campaignId}`}>/c/{c.campaignId}</Link>
                    </Text>
                  </Stack>
                </article>
              ))}
            </div>
          )}
        </Stack>
      </Section>
    </Container>
  );
}

