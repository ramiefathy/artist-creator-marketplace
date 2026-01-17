import React from 'react';
import { notFound } from 'next/navigation';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { isSocialEnabled } from '@/lib/flags';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { ProfileActions } from '@/components/social/ProfileActions';
import { ProfileHeader } from '@/components/social/ProfileHeader';
import { PostCard, type PostDoc as PostCardDoc } from '@/components/social/PostCard';

type PublicProfile = {
  uid: string;
  handle: string;
  displayName: string;
  bio: string | null;
  roleLabel: string;
  avatarAssetId: string | null;
  isPrivateAccount: boolean;
  followerCount: number;
  createdAt: string;
  updatedAt: string;
};

function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

export default async function PublicProfilePage({ params }: { params: { handle: string } }) {
  if (!isSocialEnabled()) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={1}>Profile</Heading>
            <Text color="muted">Social is disabled.</Text>
          </Stack>
        </Section>
      </Container>
    );
  }

  const handle = normalizeHandle(params.handle);
  if (!handle) notFound();

  const handleSnap = await getDoc(doc(publicDb, 'handles', handle));
  if (!handleSnap.exists()) notFound();
  const handleData = handleSnap.data() as any;
  const uid = String(handleData?.uid ?? '');
  if (!uid) notFound();

  const profileSnap = await getDoc(doc(publicDb, 'publicProfiles', uid));
  if (!profileSnap.exists()) notFound();
  const p = profileSnap.data() as any;

  const profile: PublicProfile = {
    uid,
    handle: String(p.handle ?? handle),
    displayName: String(p.displayName ?? 'User'),
    bio: (p.bio ?? null) as string | null,
    roleLabel: String(p.roleLabel ?? 'user'),
    avatarAssetId: (p.avatarAssetId ?? null) as string | null,
    isPrivateAccount: !!p.isPrivateAccount,
    followerCount: Number(p.followerCount ?? 0),
    createdAt: String(p.createdAt ?? ''),
    updatedAt: String(p.updatedAt ?? '')
  };

  const posts: PostCardDoc[] = [];
  if (!profile.isPrivateAccount) {
    // SEO-safe: only render publicly readable posts.
    try {
      const snaps = await getDocs(
        query(
          collection(publicDb, 'publicPosts'),
          where('authorUid', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      );
      posts.push(...(snaps.docs.map((d) => d.data() as any) as PostCardDoc[]));
    } catch (e) {
      console.error('PublicProfilePage: failed to load publicPosts', e);
    }
  }

  return (
    <Container size="lg">
      <Section as="section" size="lg">
        <Stack gap={6}>
          <ProfileHeader profile={profile} />

          <ProfileActions profileUid={profile.uid} profileHandle={profile.handle} isPrivateAccount={profile.isPrivateAccount} />

          <Stack gap={3} as="section">
            <Heading level={2} size="_2xl">
              Posts
            </Heading>
            {profile.isPrivateAccount ? (
              <Text color="muted">This account is private.</Text>
            ) : posts.length === 0 ? (
              <Text color="muted">No public posts yet.</Text>
            ) : (
              <Stack gap={3}>
                {posts.map((post) => (
                  <PostCard key={post.postId} post={post} preferDirectMedia />
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Section>
    </Container>
  );
}
