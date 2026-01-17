import React from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import styles from './People.module.css';

type PublicProfile = {
  uid: string;
  handle: string;
  displayName: string;
  bio?: string | null;
  roleLabel?: string;
  isPrivateAccount?: boolean;
  followerCount?: number;
  createdAt?: string;
};

export default async function PeoplePage() {
  const [trendingSnap, newestSnap] = await Promise.all([
    getDocs(query(collection(publicDb, 'publicProfiles'), orderBy('followerCount', 'desc'), limit(12))),
    getDocs(query(collection(publicDb, 'publicProfiles'), orderBy('createdAt', 'desc'), limit(12)))
  ]);

  const trending = trendingSnap.docs.map((d) => d.data() as any as PublicProfile).filter((p) => p.handle);
  const newest = newestSnap.docs.map((d) => d.data() as any as PublicProfile).filter((p) => p.handle);

  return (
    <Container size="lg">
      <Section as="section" size="lg">
        <Stack gap={8}>
          <Stack gap={2}>
            <Heading level={1}>People</Heading>
            <Text color="muted">
              Discover artists and creators across the marketplace. Follow a few accounts to make your feed feel like your room.
            </Text>
          </Stack>

          <Stack gap={4} as="section">
            <Heading level={2} size="_2xl">
              Trending
            </Heading>
            {trending.length === 0 ? <Text color="muted">No public profiles yet.</Text> : null}
            {trending.length > 0 ? (
              <div className={styles.grid}>
                {trending.map((p) => (
                  <article key={p.uid} className={styles.card}>
                    <Stack gap={2}>
                      <Heading level={3} size="xl">
                        <Link className={styles.handleLink} href={`/u/${p.handle}`}>
                          @{p.handle}
                        </Link>
                      </Heading>
                      <Text color="muted">
                        {p.displayName || 'User'} {p.roleLabel ? `· ${p.roleLabel}` : ''}
                      </Text>
                      <div className={styles.metaRow}>
                        <span className={styles.pill}>{Number(p.followerCount ?? 0)} followers</span>
                        {p.isPrivateAccount ? <span className={styles.pill}>Private</span> : <span className={styles.pill}>Public</span>}
                      </div>
                    </Stack>
                  </article>
                ))}
              </div>
            ) : null}
          </Stack>

          <Stack gap={4} as="section">
            <Heading level={2} size="_2xl">
              New faces
            </Heading>
            {newest.length === 0 ? <Text color="muted">No public profiles yet.</Text> : null}
            {newest.length > 0 ? (
              <div className={styles.grid}>
                {newest.map((p) => (
                  <article key={p.uid} className={styles.card}>
                    <Stack gap={2}>
                      <Heading level={3} size="xl">
                        <Link className={styles.handleLink} href={`/u/${p.handle}`}>
                          @{p.handle}
                        </Link>
                      </Heading>
                      <Text color="muted">
                        {p.displayName || 'User'} {p.roleLabel ? `· ${p.roleLabel}` : ''}
                      </Text>
                      <div className={styles.metaRow}>
                        <span className={styles.pill}>{Number(p.followerCount ?? 0)} followers</span>
                        {p.createdAt ? <span className={styles.pill}>Joined {String(p.createdAt).slice(0, 10)}</span> : null}
                      </div>
                    </Stack>
                  </article>
                ))}
              </div>
            ) : null}
          </Stack>
        </Stack>
      </Section>
    </Container>
  );
}

