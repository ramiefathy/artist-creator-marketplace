'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import {
  callCreateComment,
  callReportComment,
  callReportPost,
  callDeleteComment,
  callDeletePost,
  callToggleLike,
  callUpdatePost
} from '@/lib/callables';
import { Badge, Button, Card, Field, Heading, Inline, Select, Stack, Text, Textarea } from '@/design-system';
import { MediaAsset, type MediaKind } from './MediaAsset';
import styles from './PostViewerClient.module.css';

type PostVisibility = 'public' | 'followers' | 'private';

export type PostDoc = {
  postId: string;
  authorUid: string;
  authorHandle: string;
  authorRoleLabel: string;
  caption: string;
  tags: string[];
  visibility: PostVisibility;
  authorIsPrivateAccount?: boolean;
  media?: Array<{ assetId: string; kind: MediaKind; mimeType?: string }>;
  likeCount?: number;
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

type CommentDoc = {
  commentId: string;
  postId: string;
  authorUid: string;
  authorHandle: string;
  body: string;
  parentCommentId?: string | null;
  createdAt: string;
};

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  const tags = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, '_'));
  return tags.slice(0, 25).map((t) => (t.length > 32 ? t.slice(0, 32) : t));
}

function visibilityVariant(v: PostVisibility): 'neutral' | 'info' | 'warning' {
  if (v === 'followers') return 'info';
  if (v === 'private') return 'warning';
  return 'neutral';
}

export function PostViewerClient({ postId, initialPost }: { postId: string; initialPost: PostDoc | null }) {
  const { user, role } = useAuth();
  const viewerUid = user?.uid ?? null;
  const isAdmin = role === 'admin';

  const [post, setPost] = useState<PostDoc | null>(initialPost);
  const [loading, setLoading] = useState(!initialPost);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editVisibility, setEditVisibility] = useState<PostVisibility>('public');
  const [editBusy, setEditBusy] = useState(false);

  const [reportMode, setReportMode] = useState(false);
  const [reportReason, setReportReason] = useState<string>('spam');
  const [reportMessage, setReportMessage] = useState<string>('');
  const [reportBusy, setReportBusy] = useState(false);

  const isOwner = !!(viewerUid && post?.authorUid && viewerUid === post.authorUid);
  const canEdit = isOwner || isAdmin;

  const postRef = useMemo(() => doc(db, 'posts', postId), [postId]);

  async function refreshPost() {
    const snap = await getDoc(postRef);
    if (!snap.exists()) {
      setPost(null);
      return;
    }
    const data = snap.data() as any;
    if (data?.deletedAt) {
      setPost(null);
      return;
    }
    setPost(data as PostDoc);
  }

  async function refreshLikeState(nextPost: PostDoc | null) {
    if (!viewerUid || !nextPost) {
      setLiked(false);
      return;
    }
    try {
      const likeSnap = await getDoc(doc(db, 'posts', nextPost.postId, 'likes', viewerUid));
      setLiked(likeSnap.exists());
    } catch {
      setLiked(false);
    }
  }

  async function refreshComments(nextPost: PostDoc | null) {
    if (!nextPost) {
      setComments([]);
      return;
    }
    const snaps = await getDocs(query(collection(db, 'posts', nextPost.postId, 'comments'), orderBy('createdAt', 'asc'), limit(200)));
    setComments(snaps.docs.map((d) => d.data() as any) as CommentDoc[]);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrMsg(null);

    (async () => {
      await refreshPost();
    })()
      .catch((e: any) => {
        if (!cancelled) setErrMsg(e?.message ?? 'Failed to load post');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, viewerUid]);

  useEffect(() => {
    refreshLikeState(post).catch(() => undefined);
    refreshComments(post).catch(() => undefined);
    if (post) {
      setEditCaption(post.caption ?? '');
      setEditTags(Array.isArray(post.tags) ? post.tags.join(', ') : '');
      setEditVisibility(post.visibility ?? 'public');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.postId, viewerUid]);

  if (loading) return <Text color="muted">Loading…</Text>;

  if (!post) {
    return (
      <Stack gap={3} as="section">
        <Heading level={2}>Not found</Heading>
        <Text color="muted">This post may be private, deleted, or unavailable.</Text>
      </Stack>
    );
  }

  const likeCount = Number(post.likeCount ?? 0);
  const showPostContent = initialPost == null;

  return (
    <Stack gap={6} as="section">
      {errMsg ? <Text color="error">{errMsg}</Text> : null}

      {showPostContent ? (
        <Card className={styles.postCard}>
          <Stack gap={3}>
            <Inline gap={2} wrap align="center">
              <Heading level={2} size="_2xl">
                <Link href={`/u/${post.authorHandle}`}>@{post.authorHandle}</Link>
              </Heading>
              <Badge variant="neutral" size="sm">
                {post.authorRoleLabel}
              </Badge>
              <Badge variant={visibilityVariant(post.visibility)} size="sm">
                {post.visibility}
              </Badge>
            </Inline>

            <Text size="sm" className={styles.meta}>
              {fmtIso(post.createdAt)} · {likeCount} likes · {Number(post.commentCount ?? 0)} comments
            </Text>

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
              <Stack gap={3}>
                {post.media.map((m) => (
                  <MediaAsset key={m.assetId} assetId={m.assetId} kind={m.kind} />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      <Card className={styles.actionCard}>
        <Stack gap={4}>
          <Inline gap={3} wrap align="center">
            <Button
              variant={liked ? 'secondary' : 'primary'}
              disabled={!viewerUid || likeBusy}
              onClick={async () => {
                if (!viewerUid) return;
                setLikeBusy(true);
                setErrMsg(null);
                try {
                  const res = await callToggleLike({ postId: post.postId, like: !liked });
                  const nextCount = Number((res.data as any)?.likeCount ?? likeCount);
                  setLiked(!liked);
                  setPost({ ...post, likeCount: nextCount });
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed to toggle like');
                } finally {
                  setLikeBusy(false);
                }
              }}
            >
              {liked ? 'Unlike' : 'Like'}
            </Button>

            <Button
              variant="ghost"
              disabled={!viewerUid || commentBusy}
              onClick={() => {
                const el = document.getElementById('comment-body');
                if (el) (el as HTMLTextAreaElement).focus();
              }}
            >
              Comment
            </Button>

            <Button
              variant="ghost"
              disabled={!viewerUid || reportBusy}
              onClick={() => {
                setReportMode(!reportMode);
                setErrMsg(null);
              }}
            >
              Report
            </Button>

            {canEdit ? (
              <Button
                variant="secondary"
                disabled={editBusy}
                onClick={() => {
                  setEditMode(!editMode);
                  setErrMsg(null);
                }}
              >
                {editMode ? 'Close edit' : 'Edit'}
              </Button>
            ) : null}

            {canEdit ? (
              <Button
                variant="secondary"
                disabled={editBusy}
                onClick={async () => {
                  setEditBusy(true);
                  setErrMsg(null);
                  try {
                    await callDeletePost({ postId: post.postId });
                    await refreshPost();
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed to delete post');
                  } finally {
                    setEditBusy(false);
                  }
                }}
              >
                Delete
              </Button>
            ) : null}
          </Inline>

          <Text size="sm" className={styles.meta}>
            {post.visibility} · {likeCount} likes · {Number(post.commentCount ?? 0)} comments
          </Text>
        </Stack>
      </Card>

      {reportMode ? (
        <Stack gap={3} as="section">
          <Heading level={3}>Report post</Heading>
          <Field label="Reason" htmlFor="report-reason">
            <Select
              id="report-reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="hate">Hate</option>
              <option value="sexual">Sexual content</option>
              <option value="copyright">Copyright</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Message" htmlFor="report-message" helpText="Tell us what’s wrong (required).">
            <Textarea
              id="report-message"
              value={reportMessage}
              onChange={(e) => setReportMessage(e.target.value)}
              placeholder="Describe the issue…"
              disabled={!viewerUid}
              rows={4}
            />
          </Field>
          <Inline gap={3} wrap>
            <Button
              variant="primary"
              disabled={!viewerUid || reportBusy || !reportMessage.trim()}
              onClick={async () => {
                if (!viewerUid) return;
                setReportBusy(true);
                setErrMsg(null);
                try {
                  await callReportPost({ postId: post.postId, reasonCode: reportReason, message: reportMessage.trim() });
                  setReportMessage('');
                  setReportMode(false);
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed to submit report');
                } finally {
                  setReportBusy(false);
                }
              }}
            >
              Submit report
            </Button>
            <Button
              variant="secondary"
              disabled={reportBusy}
              onClick={() => {
                setReportMode(false);
              }}
            >
              Cancel
            </Button>
          </Inline>
        </Stack>
      ) : null}

      {editMode ? (
        <Stack gap={3} as="section">
          <Heading level={3}>Edit post</Heading>
          <Field label="Caption" htmlFor="edit-caption" required>
            <Textarea id="edit-caption" value={editCaption} onChange={(e) => setEditCaption(e.target.value)} rows={5} />
          </Field>
          <Field label="Tags" htmlFor="edit-tags" helpText="Comma-separated">
            <Textarea id="edit-tags" value={editTags} onChange={(e) => setEditTags(e.target.value)} rows={2} />
          </Field>
          <Field label="Visibility" htmlFor="edit-visibility">
            <Select
              id="edit-visibility"
              value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value as any)}
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </Select>
          </Field>
          <Inline gap={3} wrap>
            <Button
              variant="primary"
              disabled={editBusy}
              onClick={async () => {
                setEditBusy(true);
                setErrMsg(null);
                try {
                  await callUpdatePost({ postId: post.postId, caption: editCaption, tags: parseTags(editTags), visibility: editVisibility });
                  await refreshPost();
                  setEditMode(false);
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed to update post');
                } finally {
                  setEditBusy(false);
                }
              }}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              disabled={editBusy}
              onClick={() => {
                setEditCaption(post.caption ?? '');
                setEditTags(Array.isArray(post.tags) ? post.tags.join(', ') : '');
                setEditVisibility(post.visibility ?? 'public');
              }}
            >
              Reset
            </Button>
          </Inline>
        </Stack>
      ) : null}

      <Stack gap={3} as="section">
        <Heading level={3}>Comments</Heading>

        <Stack
          as="form"
          gap={3}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!viewerUid || commentBusy) return;
            if (!commentBody.trim()) return;
            setCommentBusy(true);
            setErrMsg(null);
            try {
              await callCreateComment({ postId: post.postId, body: commentBody.trim(), parentCommentId: null });
              setCommentBody('');
              await refreshComments(post);
              await refreshPost();
            } catch (e: any) {
              setErrMsg(e?.message ?? 'Failed to comment');
            } finally {
              setCommentBusy(false);
            }
          }}
        >
          <Field label="Add a comment" htmlFor="comment-body">
            <Textarea
              id="comment-body"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment…"
              disabled={!viewerUid}
              rows={3}
            />
          </Field>
          <Inline gap={3} wrap>
            <Button type="submit" variant="primary" disabled={!viewerUid || commentBusy}>
              {commentBusy ? 'Posting…' : 'Post comment'}
            </Button>
            <Button type="button" variant="ghost" disabled={commentBusy} onClick={() => refreshComments(post).catch(() => undefined)}>
              Refresh
            </Button>
          </Inline>
        </Stack>

        {comments.length === 0 ? <Text color="muted">No comments yet.</Text> : null}
        {comments.length > 0 ? (
          <div className={styles.commentList}>
            {comments.map((c) => {
              const canDeleteComment = isAdmin || (viewerUid && (viewerUid === c.authorUid || viewerUid === post.authorUid));
              return (
                <div key={c.commentId} className={styles.commentRow}>
                  <div className={styles.commentHeader}>
                    <div className={styles.commentMeta}>
                      <Text as="span" size="sm" className={styles.meta}>
                        <Link href={`/u/${c.authorHandle}`}>@{c.authorHandle}</Link>
                      </Text>
                      <Text as="span" size="sm" className={styles.meta}>
                        {fmtIso(c.createdAt)}
                      </Text>
                    </div>

                    <Inline gap={2} wrap align="center">
                      {viewerUid && viewerUid !== c.authorUid ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={commentBusy}
                          onClick={async () => {
                            const msg = window.prompt('Why are you reporting this comment?');
                            if (!msg) return;
                            setCommentBusy(true);
                            setErrMsg(null);
                            try {
                              await callReportComment({
                                postId: post.postId,
                                commentId: c.commentId,
                                reasonCode: 'other',
                                message: msg
                              });
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed to report comment');
                            } finally {
                              setCommentBusy(false);
                            }
                          }}
                        >
                          Report
                        </Button>
                      ) : null}
                      {canDeleteComment ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={commentBusy}
                          onClick={async () => {
                            setCommentBusy(true);
                            setErrMsg(null);
                            try {
                              await callDeleteComment({ postId: post.postId, commentId: c.commentId });
                              await refreshComments(post);
                              await refreshPost();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed to delete comment');
                            } finally {
                              setCommentBusy(false);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </Inline>
                  </div>

                  <div className={styles.commentBody}>
                    <Text whitespace="preWrap">{c.body}</Text>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Stack>
    </Stack>
  );
}
