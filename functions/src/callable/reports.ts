import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireAdmin, requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { assertSocialEnabled } from '../utils/flags';
import { enforceRateLimit } from '../utils/rateLimit';
import { canViewerReadPost, type PostVisibility } from '../utils/socialVisibility';
import { reportPostSchema, reportCommentSchema, reportUserSchema, adminUpdateReportStatusSchema } from '../schemas/requests';

type ReportDoc = {
  reportId: string;
  status: 'open' | 'resolved' | 'dismissed';
  targetType: 'post' | 'comment' | 'user';
  reporterUid: string;
  targetUid: string | null;
  postId: string | null;
  commentId: string | null;
  reasonCode: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedByUid: string | null;
  adminNote: string | null;
};

async function assertViewerCanReadPost(params: { viewerUid: string; viewerIsAdmin: boolean; postId: string }): Promise<{ post: any }> {
  const postSnap = await db().collection('posts').doc(params.postId).get();
  if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
  const post = postSnap.data() as any;
  if (post.deletedAt) err('NOT_FOUND', 'POST_NOT_FOUND');

  const authorUid: string = String(post.authorUid ?? '');
  const postVisibility: PostVisibility = post.visibility as PostVisibility;
  const authorIsPrivateAccount = !!post.authorIsPrivateAccount;

  let viewerIsApprovedFollower = false;
  if (params.viewerUid && params.viewerUid !== authorUid) {
    const followerSnap = await db().collection('follows').doc(authorUid).collection('followers').doc(params.viewerUid).get();
    viewerIsApprovedFollower = followerSnap.exists && (followerSnap.data() as any).status === 'approved';
  }

  const canRead = canViewerReadPost({
    viewerUid: params.viewerUid,
    viewerIsAdmin: params.viewerIsAdmin,
    authorUid,
    authorIsPrivateAccount,
    postVisibility,
    viewerIsApprovedFollower
  });

  if (!canRead) err('NOT_FOUND', 'POST_NOT_FOUND');

  return { post };
}

export const reportPost = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ postId: string; reasonCode: string; message: string }>(reportPostSchema, req.data);
  const now = nowIso();
  await enforceRateLimit({ uid, action: 'reportPost', nowIso: now, limits: [{ window: 'day', max: 50 }] });

  const viewerIsAdmin = role === 'admin';
  const { post } = await assertViewerCanReadPost({ viewerUid: uid, viewerIsAdmin, postId: data.postId });
  const targetUid = String(post.authorUid ?? '') || null;

  const ref = db().collection('reports').doc();
  const report: ReportDoc = {
    reportId: ref.id,
    status: 'open',
    targetType: 'post',
    reporterUid: uid,
    targetUid,
    postId: data.postId,
    commentId: null,
    reasonCode: data.reasonCode,
    message: data.message,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedByUid: null,
    adminNote: null
  };

  await ref.set(report);
  return { ok: true, reportId: ref.id };
});

export const reportComment = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ postId: string; commentId: string; reasonCode: string; message: string }>(reportCommentSchema, req.data);
  const now = nowIso();
  await enforceRateLimit({ uid, action: 'reportComment', nowIso: now, limits: [{ window: 'day', max: 100 }] });

  const viewerIsAdmin = role === 'admin';
  await assertViewerCanReadPost({ viewerUid: uid, viewerIsAdmin, postId: data.postId });

  const commentSnap = await db().collection('posts').doc(data.postId).collection('comments').doc(data.commentId).get();
  if (!commentSnap.exists) err('NOT_FOUND', 'COMMENT_NOT_FOUND');
  const comment = commentSnap.data() as any;

  const targetUid = String(comment.authorUid ?? '') || null;

  const ref = db().collection('reports').doc();
  const report: ReportDoc = {
    reportId: ref.id,
    status: 'open',
    targetType: 'comment',
    reporterUid: uid,
    targetUid,
    postId: data.postId,
    commentId: data.commentId,
    reasonCode: data.reasonCode,
    message: data.message,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedByUid: null,
    adminNote: null
  };

  await ref.set(report);
  return { ok: true, reportId: ref.id };
});

export const reportUser = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ targetUid: string; reasonCode: string; message: string }>(reportUserSchema, req.data);
  if (data.targetUid === uid) err('INVALID_ARGUMENT', 'CANNOT_REPORT_SELF');

  const now = nowIso();
  await enforceRateLimit({ uid, action: 'reportUser', nowIso: now, limits: [{ window: 'day', max: 50 }] });

  const targetProfileSnap = await db().collection('publicProfiles').doc(data.targetUid).get();
  if (!targetProfileSnap.exists) err('NOT_FOUND', 'TARGET_NOT_FOUND');

  const ref = db().collection('reports').doc();
  const report: ReportDoc = {
    reportId: ref.id,
    status: 'open',
    targetType: 'user',
    reporterUid: uid,
    targetUid: data.targetUid,
    postId: null,
    commentId: null,
    reasonCode: data.reasonCode,
    message: data.message,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedByUid: null,
    adminNote: null
  };

  await ref.set(report);
  return { ok: true, reportId: ref.id };
});

export const adminUpdateReportStatus = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid: adminUid } = requireAdmin(req);
  await requireUserActive(adminUid);

  const data = validateOrThrow<{ reportId: string; status: 'open' | 'resolved' | 'dismissed'; adminNote: string | null }>(
    adminUpdateReportStatusSchema,
    req.data
  );

  const now = nowIso();
  const ref = db().collection('reports').doc(data.reportId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err('NOT_FOUND', 'REPORT_NOT_FOUND');

    const prev = snap.data() as any;
    const next: Partial<ReportDoc> = {
      status: data.status,
      updatedAt: now,
      adminNote: data.adminNote ?? null,
      resolvedByUid: data.status === 'open' ? null : adminUid,
      resolvedAt: data.status === 'open' ? null : now
    };

    // Preserve original createdAt.
    tx.set(ref, { ...prev, ...next }, { merge: true });
  });

  return { ok: true };
});

