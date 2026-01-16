'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isSocialEnabled } from '@/lib/flags';
import { useAuth } from '@/components/AuthProvider';
import { RequireAuth } from '@/components/RequireAuth';
import { Button, Heading, Inline, Section, Stack, Text } from '@/design-system';
import { PostCard, type PostDoc } from '@/components/social/PostCard';

export default function FollowingPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [mutedUids, setMutedUids] = useState<string[]>([]);

  const refresh = useMemo(() => {
    return async () => {
      if (!uid) return;

      const followingSnap = await getDocs(
        query(collection(db, 'following', uid, 'targets'), where('status', '==', 'approved'), limit(10))
      );
      const targets = followingSnap.docs.map((d) => String((d.data() as any).targetUid ?? d.id)).filter(Boolean);
      setFollowingCount(targets.length);

      const blocked = new Set(blockedUids);
      const muted = new Set(mutedUids);
      const visibleTargets = targets.filter((t) => !blocked.has(t) && !muted.has(t));

      if (targets.length === 0 || visibleTargets.length === 0) {
        setPosts([]);
        return;
      }

      // MVP constraint: Firestore `in` queries support up to 10 values.
      const postSnap = await getDocs(
        query(
          collection(db, 'posts'),
          where('authorUid', 'in', visibleTargets),
          where('visibility', 'in', ['public', 'followers']),
          where('deletedAt', '==', null),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      );
      setPosts(postSnap.docs.map((d) => d.data() as any) as PostDoc[]);
    };
  }, [uid, blockedUids, mutedUids]);

  useEffect(() => {
    if (!uid) {
      setBlockedUids([]);
      setMutedUids([]);
      return;
    }

    Promise.all([
      getDocs(query(collection(db, 'blocks', uid, 'blocked'), limit(200))),
      getDocs(query(collection(db, 'mutes', uid, 'muted'), limit(200)))
    ])
      .then(([blockedSnap, mutedSnap]) => {
        setBlockedUids(blockedSnap.docs.map((d) => d.id).filter(Boolean).sort());
        setMutedUids(mutedSnap.docs.map((d) => d.id).filter(Boolean).sort());
      })
      .catch(() => {
        setBlockedUids([]);
        setMutedUids([]);
      });
  }, [uid]);

  useEffect(() => {
    if (!isSocialEnabled()) {
      setErrMsg('Social is disabled.');
      setLoading(false);
      return;
    }

    refresh()
      .catch((e: any) => setErrMsg(e?.message ?? 'Failed to load feed'))
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <RequireAuth>
      <Section as="section" size="lg">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>Following</Heading>
            <Text color="muted">Posts from accounts you follow (approved).</Text>
          </Stack>

          {errMsg ? <Text color="error">{errMsg}</Text> : null}

          <Inline gap={3} wrap>
            <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
              Refresh
            </Button>
            <Text color="muted" size="sm">
              Showing up to 10 followed accounts · {followingCount} active
            </Text>
          </Inline>

          {posts.length === 0 ? <Text color="muted">No posts yet.</Text> : null}
          {posts.length > 0 ? (
            <Stack gap={3}>
              {posts.map((p) => (
                <PostCard key={p.postId} post={p} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Section>
    </RequireAuth>
  );
}
