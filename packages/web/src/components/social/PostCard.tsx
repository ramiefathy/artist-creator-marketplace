'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar, Badge, ButtonLink, Card, Heading, Inline, Stack, Text } from '@/design-system';
import { MediaAsset, type MediaKind } from './MediaAsset';
import styles from './PostCard.module.css';

export type PostDoc = {
  postId: string;
  authorUid: string;
  authorHandle: string;
  authorRoleLabel: string;
  caption: string;
  tags: string[];
  visibility: 'public' | 'followers' | 'private';
  authorIsPrivateAccount?: boolean;
  media?: Array<{ assetId: string; kind: MediaKind; mimeType?: string }>;
  likeCount?: number;
  commentCount?: number;
  createdAt: string;
};

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function visibilityVariant(v: PostDoc['visibility']): 'neutral' | 'info' | 'warning' {
  if (v === 'followers') return 'info';
  if (v === 'private') return 'warning';
  return 'neutral';
}

export function PostCard({ post, preferDirectMedia }: { post: PostDoc; preferDirectMedia?: boolean }) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const media = Array.isArray(post.media) ? post.media : [];
  const likeCount = Number(post.likeCount ?? 0);
  const commentCount = Number(post.commentCount ?? 0);

  return (
    <Card data-flux-zone="tables" data-hover="lift">
      <Stack gap={3}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Avatar name={post.authorHandle} size="md" />
            <div className={styles.identity}>
              <div className={styles.handleRow}>
                <Heading level={3} size="_2xl" className={styles.handle}>
                  <Link href={`/u/${post.authorHandle}`}>@{post.authorHandle}</Link>
                </Heading>
                <Badge variant="neutral" size="sm">
                  {post.authorRoleLabel}
                </Badge>
              </div>
              <Text size="sm" className={styles.meta}>
                {fmtIso(post.createdAt)}
              </Text>
            </div>
          </div>

          <div className={styles.badges}>
            <Badge variant={visibilityVariant(post.visibility)} size="sm">
              {post.visibility}
            </Badge>
            <ButtonLink href={`/p/${post.postId}`} variant="secondary" size="sm">
              Open
            </ButtonLink>
          </div>
        </div>

        <Text className={styles.caption} whitespace="preWrap">
          {post.caption}
        </Text>

        {tags.length > 0 ? (
          <div className={styles.tags}>
            {tags.map((t) => (
              <Badge key={t} variant="neutral" size="sm" className={styles.tag}>
                #{t}
              </Badge>
            ))}
          </div>
        ) : null}

        {media.length > 0 ? (
          <div className={styles.media}>
            <div className={styles.mediaInner}>
              <Stack gap={3}>
                {media.map((m) => (
                  <MediaAsset key={m.assetId} assetId={m.assetId} kind={m.kind} preferDirectUrl={preferDirectMedia} />
                ))}
              </Stack>
            </div>
          </div>
        ) : null}

        <div className={styles.footer}>
          <Inline gap={3} wrap align="center">
            <span className={styles.counts}>
              <span>{likeCount} likes</span>
              <span>{commentCount} comments</span>
            </span>
          </Inline>
          <Text size="sm" className={styles.meta}>
            #{post.postId.slice(0, 6)}
          </Text>
        </div>
      </Stack>
    </Card>
  );
}
