import React from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { publicDb } from '@/lib/server/firebasePublic';
import { isSocialEnabled } from '@/lib/flags';
import { getMediaProxyUrl } from '@/lib/functionsUrl';
import { Container, Inline, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';
import { Avatar, Badge, Card } from '@/design-system/components/primitives';
import { PostViewerClient } from '@/components/social/PostViewerClient';
import styles from './PostPage.module.css';

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

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function visibilityVariant(v: PostVisibility): 'neutral' | 'info' | 'warning' {
  if (v === 'followers') return 'info';
  if (v === 'private') return 'warning';
  return 'neutral';
}

export default async function PublicPostPage({ params }: { params: { postId: string } }) {
  if (!isSocialEnabled()) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={1}>Post</Heading>
            <Text color="muted">Social is disabled.</Text>
          </Stack>
        </Section>
      </Container>
    );
  }

  const postId = String(params.postId ?? '').trim();
  if (!postId) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={1}>Post</Heading>
            <Text color="muted">Post not found.</Text>
          </Stack>
        </Section>
      </Container>
    );
  }

  let post: PostDoc | null = null;
  try {
    const snap = await getDoc(doc(publicDb, 'posts', postId));
    if (snap.exists()) {
      const data = snap.data() as any;
      if (!data?.deletedAt) post = data as PostDoc;
    }
  } catch {
    // If this post is private/followers-only, rules will prevent anonymous server reads.
    post = null;
  }

  return (
    <Container size="lg">
      <Section as="section" size="lg">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>Post</Heading>
            {post ? (
              <Text color="muted">
                by <Link href={`/u/${post.authorHandle}`}>@{post.authorHandle}</Link> · {fmtIso(post.createdAt)} · {post.visibility}
              </Text>
            ) : (
              <Text color="muted">Post not found.</Text>
            )}
          </Stack>

          {post ? (
            <Card className={styles.heroCard} data-hover="lift">
              <Stack gap={4} className={styles.heroInner}>
                <div className={styles.identityRow}>
                  <div className={styles.identityLeft}>
                    <Avatar name={post.authorHandle} size="md" />
                    <Stack gap={1}>
                      <Text className={styles.handle}>
                        <Link href={`/u/${post.authorHandle}`}>@{post.authorHandle}</Link>
                      </Text>
                      <Text size="sm" className={styles.meta}>
                        {fmtIso(post.createdAt)}
                      </Text>
                    </Stack>
                  </div>

                  <Inline gap={2} wrap align="center">
                    <Badge variant="neutral" size="sm">
                      {post.authorRoleLabel}
                    </Badge>
                    <Badge variant={visibilityVariant(post.visibility)} size="sm">
                      {post.visibility}
                    </Badge>
                  </Inline>
                </div>

                <Text whitespace="preWrap">{post.caption}</Text>

                {Array.isArray(post.tags) && post.tags.length > 0 ? (
                  <div className={styles.chips} aria-label="Tags">
                    {post.tags.map((t) => (
                      <Badge key={t} variant="neutral" size="sm" className={styles.chip}>
                        #{t}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {Array.isArray(post.media) && post.media.length > 0 ? (
                  <div className={styles.media}>
                    <div className={styles.mediaInner}>
                      <Stack gap={3}>
                        {post.media.map((m) => {
                          const src = getMediaProxyUrl(m.assetId);
                          if (m.kind === 'image') return <img key={m.assetId} src={src} alt="" style={{ borderRadius: 12 }} />;
                          if (m.kind === 'video') return <video key={m.assetId} src={src} controls style={{ width: '100%', borderRadius: 12 }} />;
                          return <audio key={m.assetId} src={src} controls style={{ width: '100%' }} />;
                        })}
                      </Stack>
                    </div>
                  </div>
                ) : null}
              </Stack>
            </Card>
          ) : null}

          <PostViewerClient postId={postId} initialPost={post} />
        </Stack>
      </Section>
    </Container>
  );
}
