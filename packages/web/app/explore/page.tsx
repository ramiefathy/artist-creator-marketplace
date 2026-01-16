'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { isSocialEnabled } from '@/lib/flags';
import { useAuth } from '@/components/AuthProvider';
import { callAttachMediaToPost, callCreatePost, callFinalizeMediaUpload, callInitiateMediaUpload } from '@/lib/callables';
import { Button, Field, Heading, Inline, Input, Section, Stack, Text } from '@/design-system';
import { PostCard, type PostDoc } from '@/components/social/PostCard';

function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  const tags = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, '_'));
  return tags.slice(0, 25).map((t) => (t.length > 32 ? t.slice(0, 32) : t));
}

type UploadKind = 'image' | 'video' | 'audio';

function inferUploadKind(file: File): UploadKind | null {
  const mt = (file.type ?? '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('video/')) return 'video';
  if (mt.startsWith('audio/')) return 'audio';
  return null;
}

export default function ExplorePage() {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [blockedUids, setBlockedUids] = useState<string[]>([]);
  const [mutedUids, setMutedUids] = useState<string[]>([]);

  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const canPost = !!uid && isSocialEnabled();

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
          <Heading level={1}>Explore</Heading>
          <Text color="muted">Public posts from public accounts.</Text>
        </Stack>

        {errMsg ? <Text color="error">{errMsg}</Text> : null}

        {isSocialEnabled() ? (
          <Stack gap={3} as="section">
            <Heading level={2}>
              Create a post
            </Heading>

            {!uid && !authLoading ? (
              <Text color="muted">Sign in (or enable anonymous auth) to post.</Text>
            ) : null}

            <Stack
              as="form"
              gap={4}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!canPost || busy) return;
                setBusy(true);
                setErrMsg(null);
                setUploadStatus(null);

                try {
                  const tags = parseTags(tagsInput);
                  const postRes = await callCreatePost({ caption, tags, visibility });
                  const postId = String((postRes.data as any)?.postId ?? '');
                  if (!postId) throw new Error('Failed to create post');

                  if (file) {
                    const kind = inferUploadKind(file);
                    if (!kind) throw new Error('Unsupported file type');

                    setUploadStatus('Initiating upload…');
                    const initRes = await callInitiateMediaUpload({
                      kind,
                      mimeType: file.type,
                      sizeBytes: file.size,
                      originalFilename: file.name
                    });
                    const uploadId = String((initRes.data as any)?.uploadId ?? '');
                    const storagePath = String((initRes.data as any)?.storagePath ?? '');
                    if (!uploadId || !storagePath) throw new Error('Upload init failed');

                    setUploadStatus('Uploading bytes…');
                    await uploadBytes(storageRef(storage, storagePath), file, { contentType: file.type });

                    setUploadStatus('Finalizing…');
                    const finRes = await callFinalizeMediaUpload({ uploadId });
                    const assetId = String((finRes.data as any)?.assetId ?? '');
                    if (!assetId) throw new Error('Upload finalize failed');

                    setUploadStatus('Attaching to post…');
                    await callAttachMediaToPost({ postId, assetId });
                  }

                  setCaption('');
                  setTagsInput('');
                  setVisibility('public');
                  setFile(null);
                  setUploadStatus(null);

                  await refresh();
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed to create post');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Caption" htmlFor="caption" required>
                <Input
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  required
                  placeholder="What are you working on?"
                />
              </Field>

              <Field label="Tags" htmlFor="tags" helpText="Comma-separated (optional)">
                <Input id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="music, studio, behind_the_scenes" />
              </Field>

              <Field label="Visibility" htmlFor="visibility">
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  style={{ width: '100%', padding: 12, borderRadius: 12 }}
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="private">Private</option>
                </select>
              </Field>

              <Field label="Media" htmlFor="file" helpText="Optional: image/video/audio (served via proxy)">
                <Input
                  id="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>

              <Inline gap={3} wrap>
                <Button type="submit" variant="primary" disabled={!canPost || busy}>
                  {busy ? 'Posting…' : 'Post'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setCaption('');
                    setTagsInput('');
                    setVisibility('public');
                    setFile(null);
                    setUploadStatus(null);
                    setErrMsg(null);
                  }}
                >
                  Clear
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => refresh().catch(() => undefined)}>
                  Refresh feed
                </Button>
              </Inline>

              {uploadStatus ? <Text color="muted">{uploadStatus}</Text> : null}
            </Stack>
          </Stack>
        ) : null}

        <Stack gap={3} as="section">
          <Heading level={2}>
            Recent posts
          </Heading>
          {loading ? <Text color="muted">Loading…</Text> : null}
          {!loading && posts.length === 0 ? <Text color="muted">No posts yet.</Text> : null}
          {posts.length > 0 ? (
            <Stack gap={3}>
              {posts.map((p) => (
                <PostCard key={p.postId} post={p} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    </Section>
  );
}
