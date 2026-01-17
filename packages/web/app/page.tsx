import { ThemeShowcase } from '@/design-system/components/theme';
import { Container, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { ButtonLink } from '@/design-system/components/primitives';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { isSocialEnabled } from '@/lib/flags';
import styles from './page.module.css';

type HubPost = {
  postId: string;
  authorHandle: string;
  caption: string;
  tags?: string[];
  likeCount?: number;
  commentCount?: number;
  createdAt: string;
};

type HubCampaign = {
  campaignId: string;
  title: string;
  status: string;
  platforms?: string[];
  deliverableSpec?: { deliverablesTotal?: number; dueDaysAfterActivation?: number };
  pricing?: { currency?: string; maxPricePerDeliverableCents?: number };
  artist?: { handle?: string; displayName?: string };
  createdAt: string;
};

type HubPerson = {
  uid: string;
  handle: string;
  displayName: string;
  roleLabel?: string;
  followerCount?: number;
  createdAt?: string;
};

function truncate(text: string, max: number): string {
  const t = String(text ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function fmtMoney(cents: number | undefined, currency: string | undefined): string {
  const amount = Number.isFinite(Number(cents)) ? Number(cents) / 100 : 0;
  const curr = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${amount.toFixed(0)}`;
  }
}

export default function HomePage() {
  const social = isSocialEnabled();

  if (social) {
    return <SocialHubHome />;
  }

  return (
    <div className={styles.main}>
      <Container size="xl">
        <section className={styles.hero} data-flux-zone="hero">
          <Heading level={1} size="_4xl" className={styles.title}>
            Where Artists &amp; Creators Make Music Viral
          </Heading>
          <Text size="lg" color="muted" className={styles.subtitle}>
            The marketplace connecting musicians with content creators for authentic promotion.
          </Text>
        </section>

        <section className={styles.themeSection} data-flux-zone="marketing">
          <Heading level={2} size="xl" className={styles.sectionTitle}>
            Choose your mode
          </Heading>
          <Text color="muted">
            Pick a look that matches how you work: modern “Studio Desk” polish or warm “Liner Notes” editorial.
          </Text>
          <ThemeShowcase />
        </section>

        <section className={styles.cta} data-flux-zone="marketing">
          <ButtonLink href="/signup" size="lg">
            Get Started
          </ButtonLink>
          <ButtonLink href="/login" size="lg" variant="secondary">
            Log In
          </ButtonLink>
        </section>
      </Container>
    </div>
  );
}

async function SocialHubHome() {
  const [postSnap, campaignSnap, peopleSnap] = await Promise.all([
    getDocs(
      query(
        // SEO-safe, public-read feed.
        collection(publicDb, 'publicPosts'),
        orderBy('createdAt', 'desc'),
        limit(8)
      )
    ),
    getDocs(query(collection(publicDb, 'publicCampaigns'), where('status', '==', 'live'), orderBy('createdAt', 'desc'), limit(6))),
    getDocs(query(collection(publicDb, 'publicProfiles'), orderBy('followerCount', 'desc'), limit(6)))
  ]);

  const posts = postSnap.docs.map((d) => d.data() as any as HubPost);
  const campaigns = campaignSnap.docs.map((d) => d.data() as any as HubCampaign);
  const people = peopleSnap.docs.map((d) => d.data() as any as HubPerson).filter((p) => p.handle);

  return (
    <div className={styles.main}>
      <Container size="xl">
        <section className={styles.hubHero} data-flux-zone="hero">
          <Heading level={1} size="_4xl" className={styles.title}>
            Your MCMP hub
          </Heading>
          <Text size="lg" color="muted" className={styles.subtitle}>
            A living front page: public posts, shareable campaigns, and people worth following — all in one place.
          </Text>
          <div className={styles.hubActions}>
            <ButtonLink href="/explore" size="lg">
              Explore posts
            </ButtonLink>
            <ButtonLink href="/campaigns" size="lg" variant="secondary">
              Browse campaigns
            </ButtonLink>
            <ButtonLink href="/people" size="lg" variant="secondary">
              People
            </ButtonLink>
          </div>
        </section>

        <section className={styles.hubGrid} data-flux-zone="hub">
          <div className={`${styles.hubModule} ${styles.hubModuleWide}`}>
            <div className={styles.hubModuleHeader}>
              <Stack>
                <Heading level={2} size="xl">
                  Latest posts
                </Heading>
                <Text color="muted">What people are working on right now.</Text>
              </Stack>
              <ButtonLink href="/explore" variant="secondary" size="sm">
                See all
              </ButtonLink>
            </div>

            {posts.length === 0 ? (
              <Text color="muted" style={{ marginTop: 'var(--spacing-4)' }}>
                No public posts yet. Be the first to log a session note.
              </Text>
            ) : (
              <div className={styles.hubList}>
                {posts.map((p) => (
                  <article key={p.postId} className={styles.hubItem}>
                    <Heading level={3} size="xl">
                      <Link className={styles.hubItemTitle} href={`/p/${p.postId}`}>
                        {truncate(p.caption, 90) || 'Post'}
                      </Link>
                    </Heading>
                    <Text color="muted">
                      {p.authorHandle ? (
                        <>
                          by <Link href={`/u/${p.authorHandle}`}>@{p.authorHandle}</Link>
                        </>
                      ) : (
                        <>by a member</>
                      )}
                    </Text>
                    <div className={styles.hubMetaRow}>
                      <span className={styles.hubPill}>{Number(p.likeCount ?? 0)} likes</span>
                      <span className={styles.hubPill}>{Number(p.commentCount ?? 0)} comments</span>
                      {Array.isArray(p.tags) && p.tags.length > 0 ? <span className={styles.hubPill}>#{String(p.tags[0])}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={styles.hubModule}>
            <div className={styles.hubModuleHeader}>
              <Stack>
                <Heading level={2} size="xl">
                  Public campaigns
                </Heading>
                <Text color="muted">Shareable opportunities for creators.</Text>
              </Stack>
              <ButtonLink href="/campaigns" variant="secondary" size="sm">
                Browse
              </ButtonLink>
            </div>

            {campaigns.length === 0 ? (
              <Text color="muted" style={{ marginTop: 'var(--spacing-4)' }}>
                No public campaigns yet.
              </Text>
            ) : (
              <div className={styles.hubList}>
                {campaigns.map((c) => (
                  <article key={c.campaignId} className={styles.hubItem}>
                    <Heading level={3} size="xl">
                      <Link className={styles.hubItemTitle} href={`/c/${c.campaignId}`}>
                        {truncate(c.title, 80) || 'Campaign'}
                      </Link>
                    </Heading>
                    <Text color="muted">
                      {c.artist?.handle ? (
                        <>
                          by <Link href={`/u/${c.artist.handle}`}>@{c.artist.handle}</Link>
                        </>
                      ) : (
                        <>by an artist</>
                      )}
                    </Text>
                    <div className={styles.hubMetaRow}>
                      <span className={styles.hubPill}>{fmtMoney(c.pricing?.maxPricePerDeliverableCents, c.pricing?.currency)}</span>
                      <span className={styles.hubPill}>Deliverables: {Number(c.deliverableSpec?.deliverablesTotal ?? 0) || 0}</span>
                      {Array.isArray(c.platforms) && c.platforms.length > 0 ? <span className={styles.hubPill}>{String(c.platforms[0])}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className={styles.hubModule}>
            <div className={styles.hubModuleHeader}>
              <Stack>
                <Heading level={2} size="xl">
                  People
                </Heading>
                <Text color="muted">Accounts worth following.</Text>
              </Stack>
              <ButtonLink href="/people" variant="secondary" size="sm">
                Discover
              </ButtonLink>
            </div>

            {people.length === 0 ? (
              <Text color="muted" style={{ marginTop: 'var(--spacing-4)' }}>
                No public profiles yet.
              </Text>
            ) : (
              <div className={styles.hubList}>
                {people.map((p) => (
                  <article key={p.uid} className={styles.hubItem}>
                    <Heading level={3} size="xl">
                      <Link className={styles.hubItemTitle} href={`/u/${p.handle}`}>
                        @{p.handle}
                      </Link>
                    </Heading>
                    <Text color="muted">
                      {p.displayName || 'User'} {p.roleLabel ? `· ${p.roleLabel}` : ''}
                    </Text>
                    <div className={styles.hubMetaRow}>
                      <span className={styles.hubPill}>{Number(p.followerCount ?? 0)} followers</span>
                      {p.createdAt ? <span className={styles.hubPill}>Joined {String(p.createdAt).slice(0, 10)}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={styles.themeSection} data-flux-zone="marketing">
          <Heading level={2} size="xl" className={styles.sectionTitle}>
            Choose your mode
          </Heading>
          <Text color="muted">Studio Desk for polish. Liner Notes for warmth. Switch any time.</Text>
          <ThemeShowcase />
        </section>
      </Container>
    </div>
  );
}
