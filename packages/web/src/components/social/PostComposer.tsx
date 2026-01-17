'use client';

import React, { useMemo, useState } from 'react';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { isSocialEnabled } from '@/lib/flags';
import { useAuth } from '@/components/AuthProvider';
import { callAttachMediaToPost, callCreatePost, callFinalizeMediaUpload, callInitiateMediaUpload } from '@/lib/callables';
import { useTheme } from '@/design-system/providers';
import { Badge, Button, Card, Field, Heading, Inline, Input, Select, Stack, Text, Textarea } from '@/design-system';
import styles from './PostComposer.module.css';

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

type Visibility = 'public' | 'followers' | 'private';

export function PostComposer(props: { onPosted?: () => void | Promise<void>; onRefresh?: () => void | Promise<void> }) {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [file, setFile] = useState<File | null>(null);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);
  const canPost = !!uid && isSocialEnabled();

  const copy = useMemo(() => {
    if (theme === 'liner') {
      return {
        kicker: 'Liner Notes',
        title: 'Write a liner note',
        subtitle: 'A short note from the room — what you’re building, hearing, or shipping.',
        captionLabel: 'Note',
        captionPlaceholder: 'Write something you’d want printed in the credits…',
        tagsPlaceholder: 'credits, session, mixing',
        mediaHelp: 'Optional: image/video/audio (served via proxy).'
      };
    }
    return {
      kicker: 'Studio Desk',
      title: 'Log a session note',
      subtitle: 'Capture a take, a decision, a reference, or what’s next.',
      captionLabel: 'Session note',
      captionPlaceholder: 'What are you working on right now?',
      tagsPlaceholder: 'studio, mix_notes, release_day',
      mediaHelp: 'Optional: image/video/audio (served via proxy).'
    };
  }, [theme]);

  function clearForm() {
    setCaption('');
    setTagsInput('');
    setVisibility('public');
    setFile(null);
    setUploadStatus(null);
    setErrMsg(null);
  }

  return (
    <Card className={styles.card} data-hover="lift">
      <Stack gap={4} className={styles.inner}>
        <div className={styles.headerRow}>
          <Stack gap={1}>
            <Text size="sm" className={styles.kicker}>
              {copy.kicker}
            </Text>
            <Heading level={2} size="_2xl">
              {copy.title}
            </Heading>
            <Text color="muted">{copy.subtitle}</Text>
          </Stack>

          {props.onRefresh ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setErrMsg(null);
                setUploadStatus(null);
                Promise.resolve(props.onRefresh?.()).catch(() => undefined);
              }}
            >
              Refresh
            </Button>
          ) : null}
        </div>

        <div className={styles.divider} />

        {!isSocialEnabled() ? (
          <Text color="muted">Social is disabled.</Text>
        ) : !uid && !authLoading ? (
          <Text color="muted">Sign in (or enable anonymous auth) to post.</Text>
        ) : null}

        {errMsg ? <Text color="error">{errMsg}</Text> : null}
        {uploadStatus ? <Text color="muted">{uploadStatus}</Text> : null}

        <Stack
          as="form"
          gap={4}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canPost || busy) return;

            const trimmed = caption.trim();
            if (!trimmed) {
              setErrMsg('Write a note first.');
              return;
            }

            setBusy(true);
            setErrMsg(null);
            setUploadStatus(null);

            try {
              const postRes = await callCreatePost({ caption: trimmed, tags, visibility });
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

              setUploadStatus(null);
              clearForm();
              await Promise.resolve(props.onPosted?.());
            } catch (e: any) {
              setErrMsg(e?.message ?? 'Failed to create post');
            } finally {
              setBusy(false);
              setUploadStatus(null);
            }
          }}
        >
          <Field label={copy.captionLabel} htmlFor="caption" required>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              required
              rows={theme === 'liner' ? 7 : 6}
              placeholder={copy.captionPlaceholder}
              disabled={!isSocialEnabled() || !uid || busy}
            />
          </Field>

          <Field label="Tags" htmlFor="tags" helpText="Comma-separated (optional)">
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={copy.tagsPlaceholder}
              disabled={!isSocialEnabled() || !uid || busy}
            />
            {tags.length > 0 ? (
              <div className={styles.chips} aria-label="Tag preview">
                {tags.map((t) => (
                  <Badge key={t} variant="neutral" size="sm" style={{ background: 'var(--social-chip-bg)', borderColor: 'var(--social-chip-border)', color: 'var(--social-chip-text)' }}>
                    #{t}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Field>

          <Field label="Visibility" htmlFor="visibility">
            <Select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              disabled={!isSocialEnabled() || !uid || busy}
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </Select>
          </Field>

          <Field label="Media" htmlFor="file" helpText={copy.mediaHelp}>
            <Stack gap={2}>
              <Input
                id="file"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={!isSocialEnabled() || !uid || busy}
              />

              {file ? (
                <div className={styles.fileMeta}>
                  <span className={styles.fileName}>{file.name}</span>
                  <Text size="sm" color="muted">
                    {inferUploadKind(file) ?? 'file'} · {(file.size / 1024 / 1024).toFixed(1)} MB
                  </Text>
                </div>
              ) : null}
            </Stack>
          </Field>

          <Inline gap={3} wrap>
            <Button type="submit" variant="primary" disabled={!canPost || busy}>
              {busy ? 'Posting…' : 'Post'}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={clearForm}>
              Clear
            </Button>
          </Inline>
        </Stack>
      </Stack>
    </Card>
  );
}
