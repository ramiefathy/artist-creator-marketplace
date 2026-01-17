import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { ButtonLink } from '@/design-system/components/primitives';
import styles from './CampaignPublic.module.css';

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
  updatedAt: string;
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

function titleCase(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => (w ? `${w[0].toUpperCase()}${w.slice(1)}` : w))
    .join(' ');
}

export default async function PublicCampaignPage({ params }: { params: { campaignId: string } }) {
  const campaignId = String(params.campaignId ?? '').trim();
  if (!campaignId) notFound();

  const snap = await getDoc(doc(publicDb, 'publicCampaigns', campaignId));
  if (!snap.exists()) notFound();
  const c = snap.data() as any as PublicCampaign;

  const platform = Array.isArray(c.platforms) && c.platforms.length > 0 ? String(c.platforms[0]) : '';
  const deliverableType = titleCase(String(c.deliverableSpec?.deliverableType ?? 'deliverable'));
  const maxPrice = fmtMoney(Number(c.pricing?.maxPricePerDeliverableCents ?? 0), String(c.pricing?.currency ?? 'USD'));
  const dueDays = Number(c.deliverableSpec?.dueDaysAfterActivation ?? 0) || 0;
  const remainDays = Number(c.deliverableSpec?.postMustRemainLiveDays ?? 0) || 0;

  const isLive = String(c.status) === 'live';

  return (
    <Container size="lg">
      <Section as="section" size="lg">
        <Stack gap={6}>
          <div className={styles.hero}>
            <div className={styles.heroTop}>
              <Stack gap={2}>
                <Heading level={1} size="_4xl">
                  {c.title}
                </Heading>
                <Text color="muted">
                  {c.artist?.handle ? (
                    <>
                      by <Link href={`/u/${c.artist.handle}`}>@{c.artist.handle}</Link>
                    </>
                  ) : (
                    <>by {c.artist?.displayName ?? 'Artist'}</>
                  )}{' '}
                  · Track: <strong>{c.track?.title ?? 'Untitled'}</strong> {c.track?.artistName ? `— ${c.track.artistName}` : ''}
                </Text>
                {!isLive ? (
                  <Text color="muted">
                    Status: <strong>{String(c.status)}</strong> · This campaign may not be accepting new offers right now.
                  </Text>
                ) : null}
              </Stack>

              <div className={styles.heroActions}>
                <ButtonLink href="/signup" size="lg">
                  Submit an offer
                </ButtonLink>
                <ButtonLink href="/campaigns" size="lg" variant="secondary">
                  Browse campaigns
                </ButtonLink>
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>Max price / deliverable</div>
                <div className={styles.metaValue}>{maxPrice}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>Deliverables total</div>
                <div className={styles.metaValue}>{Number(c.deliverableSpec?.deliverablesTotal ?? 0) || 0}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>Platform</div>
                <div className={styles.metaValue}>{platform ? titleCase(platform) : '—'}</div>
              </div>
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>Due after activation</div>
                <div className={styles.metaValue}>{dueDays ? `${dueDays} days` : '—'}</div>
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <Stack gap={3}>
              <Heading level={2} size="_2xl">
                Brief
              </Heading>
              <Text>{String(c.brief ?? '').trim()}</Text>
            </Stack>
          </div>

          <div className={styles.sectionCard}>
            <Stack gap={3}>
              <Heading level={2} size="_2xl">
                What you’re making
              </Heading>
              <Stack gap={2}>
                <Text>
                  <strong>{deliverableType}</strong> on {platform ? titleCase(platform) : 'the requested platform'}.
                </Text>
                <Text color="muted">
                  Due {dueDays ? `${dueDays} days` : '—'} after activation{remainDays ? ` · Must remain live for ${remainDays} days` : ''}.
                </Text>
              </Stack>
            </Stack>
          </div>

          <div className={styles.sectionCard}>
            <Stack gap={3}>
              <Heading level={2} size="_2xl">
                Shareable link
              </Heading>
              <Text color="muted">
                This page is designed for sharing and SEO. If you’re the campaign owner, manage details from your artist dashboard.
              </Text>
              <Text className={styles.mono}>/c/{c.campaignId}</Text>
            </Stack>
          </div>
        </Stack>
      </Section>
    </Container>
  );
}

