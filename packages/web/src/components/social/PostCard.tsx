'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Heading, Inline, Stack, Text } from '@/design-system';
import { MediaAsset, type MediaKind } from './MediaAsset';

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

export function PostCard({ post }: { post: PostDoc }) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const media = Array.isArray(post.media) ? post.media : [];

  return (
    <Card data-flux-zone="tables">
      <Stack gap={3}>
        <Inline gap={2} wrap align="center">
          <Heading level={3}>
            <Link href={`/u/${post.authorHandle}`}>@{post.authorHandle}</Link>
          </Heading>
          <Text size="sm" color="muted">
            {fmtIso(post.createdAt)}
          </Text>
          <Text size="sm" color="muted">
            · {post.visibility}
          </Text>
          <Text size="sm" color="muted">
            · <Link href={`/p/${post.postId}`}>Open</Link>
          </Text>
        </Inline>

        <Text>{post.caption}</Text>

        {tags.length > 0 ? (
          <Inline gap={2} wrap>
            {tags.map((t) => (
              <Text key={t} size="sm" color="muted">
                #{t}
              </Text>
            ))}
          </Inline>
        ) : null}

        {media.length > 0 ? (
          <Stack gap={3}>
            {media.map((m) => (
              <MediaAsset key={m.assetId} assetId={m.assetId} kind={m.kind} />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}
