import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { isSocialEnabled } from '@/lib/flags';
import { getMediaProxyUrl } from '@/lib/functionsUrl';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { ProfileActions } from '@/components/social/ProfileActions';

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

type PostVisibility = 'public' | 'followers' | 'private';

type PostDoc = {
  postId: string;
  authorUid: string;
  authorHandle: string;
  authorRoleLabel: string;
  caption: string;
  tags: string[];
  visibility: PostVisibility;
  authorIsPrivateAccount: boolean;
  media?: Array<{ assetId: string; kind: 'image' | 'video' | 'audio'; mimeType?: string }>;
  likeCount?: number;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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

  const posts: PostDoc[] = [];
  if (!profile.isPrivateAccount) {
    // SEO-safe: only render publicly readable posts.
    const snaps = await getDocs(
      query(
        collection(publicDb, 'posts'),
        where('authorUid', '==', uid),
        where('authorIsPrivateAccount', '==', false),
        where('visibility', '==', 'public'),
        where('deletedAt', '==', null),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    );
    posts.push(...(snaps.docs.map((d) => d.data() as any) as PostDoc[]));
  }

  return (
    <Container size="lg">
      <Section as="section" size="lg">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>{profile.displayName}</Heading>
            <Text color="muted">
              @{profile.handle} · {profile.roleLabel} · {profile.followerCount} followers
            </Text>
            <Text color="muted">Updated {profile.updatedAt ? fmtIso(profile.updatedAt) : '—'}</Text>
          </Stack>

          {profile.bio ? <Text>{profile.bio}</Text> : <Text color="muted">No bio yet.</Text>}

          {profile.isPrivateAccount ? (
            <Text color="muted">This account is private. Public posts are hidden.</Text>
          ) : null}

          <ProfileActions profileUid={profile.uid} profileHandle={profile.handle} isPrivateAccount={profile.isPrivateAccount} />

          <Stack gap={3} as="section">
            <Heading level={2}>Posts</Heading>
            {profile.isPrivateAccount ? (
              <Text color="muted">This account is private.</Text>
            ) : posts.length === 0 ? (
              <Text color="muted">No public posts yet.</Text>
            ) : (
              <Stack gap={4}>
                {posts.map((post) => (
                  <article key={post.postId}>
                    <Stack gap={2}>
                      <Text color="muted" size="sm">
                        <Link href={`/p/${post.postId}`}>Open post</Link> · {fmtIso(post.createdAt)} · {post.likeCount ?? 0} likes ·{' '}
                        {post.commentCount ?? 0} comments
                      </Text>
                      <Text>{post.caption}</Text>

                      {Array.isArray(post.tags) && post.tags.length > 0 ? (
                        <Text color="muted" size="sm">
                          {post.tags.map((t) => `#${t}`).join(' ')}
                        </Text>
                      ) : null}

                      {Array.isArray(post.media) && post.media.length > 0 ? (
                        <Stack gap={3}>
                          {post.media.map((m) => {
                            const src = getMediaProxyUrl(m.assetId);
                            if (m.kind === 'image') return <img key={m.assetId} src={src} alt="" style={{ borderRadius: 12 }} />;
                            if (m.kind === 'video') return <video key={m.assetId} src={src} controls style={{ width: '100%', borderRadius: 12 }} />;
                            return <audio key={m.assetId} src={src} controls style={{ width: '100%' }} />;
                          })}
                        </Stack>
                      ) : null}
                    </Stack>
                  </article>
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Section>
    </Container>
  );
}

