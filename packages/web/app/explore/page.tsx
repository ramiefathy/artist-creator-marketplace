'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isSocialEnabled } from '@/lib/flags';
import { useAuth } from '@/components/AuthProvider';
import { Heading, Section, Stack, Text } from '@/design-system';
import { PostCard, type PostDoc } from '@/components/social/PostCard';
import { PostComposer } from '@/components/social/PostComposer';
import styles from './Explore.module.css';

export default function ExplorePage() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [mutedUids, setMutedUids] = useState<string[]>([]);

  const refresh = useMemo(() => {
    return async () => {
      const snaps = await getDocs(
        query(
          collection(db, 'posts'),
          where('visibility', '==', 'public'),
          where('authorIsPrivateAccount', '==', false),
          where('deletedAt', '==', null),
          orderBy('createdAt', 'desc'),
          limit(50)
        )
      );
      const list = snaps.docs.map((d) => d.data() as any) as PostDoc[];
      if (blockedUids.length === 0 && mutedUids.length === 0) {
        setPosts(list);
        return;
      }
      const blocked = new Set(blockedUids);
      const muted = new Set(mutedUids);
      setPosts(list.filter((p) => !blocked.has(String((p as any).authorUid ?? '')) && !muted.has(String((p as any).authorUid ?? ''))));
    };
  }, [blockedUids, mutedUids]);

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
        // If rules deny, ignore and show unfiltered feed.
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
      .catch((e: any) => setErrMsg(e?.message ?? 'Failed to load posts'))
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <Section as="section" size="lg">
      <Stack gap={6}>
        <Stack gap={2}>
          <div className={styles.sectionHeader}>
            <Heading level={1}>Explore</Heading>
          </div>
          <Text color="muted" className={styles.subhead}>
            Public posts from public accounts — session notes, liner notes, and quick updates from across the marketplace.
          </Text>
        </Stack>

        {errMsg ? <Text color="error">{errMsg}</Text> : null}

        <div className={styles.layout}>
          <div className={styles.left}>
            {isSocialEnabled() ? (
              <PostComposer
                onPosted={async () => {
                  await refresh();
                }}
                onRefresh={async () => {
                  await refresh();
                }}
              />
            ) : null}

            {!uid && !authLoading && isSocialEnabled() ? (
              <Text color="muted" size="sm">
                If anonymous auth is enabled, the app will automatically create a guest identity.
              </Text>
            ) : null}
          </div>

          <div className={styles.right}>
            <Stack gap={3} as="section">
              <Heading level={2} size="_2xl">
                Recent posts
              </Heading>
              {loading ? <Text color="muted">Loading…</Text> : null}
              {!loading && posts.length === 0 ? <Text color="muted">No posts yet.</Text> : null}
              {posts.length > 0 ? (
                <Stack gap={3}>
                  {posts.map((p) => (
                    <PostCard key={p.postId} post={p} preferDirectMedia />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </div>
        </div>
      </Stack>
    </Section>
  );
}
