import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import {
  setAccountPrivacySchema,
  requestFollowSchema,
  approveFollowerSchema,
  removeFollowerSchema,
  unfollowSchema,
  createPostSchema,
  updatePostSchema,
  deletePostSchema,
  createCommentSchema,
  deleteCommentSchema,
  toggleLikeSchema,
  claimHandleSchema
} from '../schemas/requests';
import { ensurePublicIdentity } from '../utils/publicIdentity';
import { canViewerReadPost, type PostVisibility } from '../utils/socialVisibility';
import { assertSocialEnabled } from '../utils/flags';
import { isValidHandle, normalizeHandle } from '../utils/handles';
import { assertCanChangeHandle } from '../utils/handleCooldown';
import { enforceRateLimit } from '../utils/rateLimit';
import { assertNotBlocked } from '../utils/blocks';

function isAnonymousProvider(req: any): boolean {
  const provider = (req?.auth?.token as any)?.firebase?.sign_in_provider;
  return provider === 'anonymous';
}

async function getViewerContext(req: any): Promise<{ uid: string; role: string; isAdmin: boolean; handle: string }> {
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const preferGuest = isAnonymousProvider(req);
  const displayNameOrEmail =
    (req.auth?.token as any)?.name ??
    (req.auth?.token as any)?.email ??
    null;

  const ident = await ensurePublicIdentity({
    uid,
    displayNameOrEmail,
    preferGuest,
    roleLabel: role === 'unassigned' && preferGuest ? 'guest' : role
  });

  return { uid, role, isAdmin: role === 'admin', handle: ident.handle };
}

async function loadPostAccess(params: { viewerUid: string | null; viewerIsAdmin: boolean; postId: string }) {
  const postRef = db().collection('posts').doc(params.postId);
  const postSnap = await postRef.get();
  if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
  const post = postSnap.data() as any;

  const authorUid: string = post.authorUid;
  const postVisibility: PostVisibility = post.visibility as PostVisibility;

  const profileSnap = await db().collection('publicProfiles').doc(authorUid).get();
  const authorIsPrivateAccount = profileSnap.exists ? !!(profileSnap.data() as any).isPrivateAccount : false;

  let viewerIsApprovedFollower = false;
  if (params.viewerUid) {
    const followerSnap = await db()
      .collection('follows')
      .doc(authorUid)
      .collection('followers')
      .doc(params.viewerUid)
      .get();
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

  if (!canRead) {
    // Hidden private content: behave like not-found.
    err('NOT_FOUND', 'POST_NOT_FOUND');
  }

  return { postRef, postSnap, post, authorUid };
}

export const setAccountPrivacy = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ isPrivateAccount: boolean }>(setAccountPrivacySchema, req.data);

  const now = nowIso();
  await db().collection('publicProfiles').doc(viewer.uid).set({ isPrivateAccount: data.isPrivateAccount, updatedAt: now }, { merge: true });

  // Keep post privacy snapshot in sync so public queries remain safe.
  // Best-effort: paginate until done, but keep each batch small.
  let last: any | null = null;
  for (let i = 0; i < 25; i++) {
    let q = db().collection('posts').where('authorUid', '==', viewer.uid).orderBy('createdAt', 'desc').limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db().batch();
    for (const doc of snap.docs) {
      batch.set(doc.ref, { authorIsPrivateAccount: data.isPrivateAccount, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 200) break;
  }

  return { ok: true };
});

export const requestFollow = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ targetUid: string }>(requestFollowSchema, req.data);
  if (data.targetUid === viewer.uid) err('INVALID_ARGUMENT', 'CANNOT_FOLLOW_SELF');

  const now = nowIso();
  await enforceRateLimit({ uid: viewer.uid, action: 'requestFollow', nowIso: now, limits: [{ window: 'day', max: 10 }] });
  await assertNotBlocked({ viewerUid: viewer.uid, targetUid: data.targetUid });

  const targetProfileSnap = await db().collection('publicProfiles').doc(data.targetUid).get();
  if (!targetProfileSnap.exists) err('NOT_FOUND', 'TARGET_NOT_FOUND');
  const targetProfile = targetProfileSnap.data() as any;
  const isTargetPrivate = !!targetProfile.isPrivateAccount;

  const status: 'requested' | 'approved' = isTargetPrivate ? 'requested' : 'approved';

  const followerRef = db().collection('follows').doc(data.targetUid).collection('followers').doc(viewer.uid);
  const followingRef = db().collection('following').doc(viewer.uid).collection('targets').doc(data.targetUid);
  const targetPublicRef = db().collection('publicProfiles').doc(data.targetUid);

  await db().runTransaction(async (tx) => {
    const existingFollower = await tx.get(followerRef);
    const prevStatus = existingFollower.exists ? ((existingFollower.data() as any).status as string) : null;

    // If already approved, keep approved.
    const nextStatus = prevStatus === 'approved' ? 'approved' : status;

    tx.set(
      followerRef,
      {
        followerUid: viewer.uid,
        targetUid: data.targetUid,
        status: nextStatus,
        createdAt: existingFollower.exists ? (existingFollower.data() as any).createdAt ?? now : now,
        updatedAt: now
      },
      { merge: true }
    );

    tx.set(
      followingRef,
      {
        followerUid: viewer.uid,
        targetUid: data.targetUid,
        status: nextStatus,
        createdAt: now,
        updatedAt: now
      },
      { merge: true }
    );

    // Only increment on transition to approved.
    if (prevStatus !== 'approved' && nextStatus === 'approved') {
      const targetSnap = await tx.get(targetPublicRef);
      if (targetSnap.exists) {
        const current = Number((targetSnap.data() as any).followerCount ?? 0);
        tx.update(targetPublicRef, { followerCount: current + 1, updatedAt: now });
      }
    }
  });

  return { ok: true, status };
});

export const claimHandle = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ handle: string }>(claimHandleSchema, req.data);

  const nextHandle = normalizeHandle(data.handle);
  if (!isValidHandle(nextHandle)) err('INVALID_ARGUMENT', 'INVALID_HANDLE');

  const now = nowIso();
  const handlesCol = db().collection('handles');
  const profileRef = db().collection('publicProfiles').doc(viewer.uid);

  const { handle, changed } = await db().runTransaction(async (tx) => {
    const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists) err('NOT_FOUND', 'PROFILE_NOT_FOUND');
    const profile = profileSnap.data() as any;
    const currentHandle = String(profile.handle ?? '');

    if (currentHandle === nextHandle) return { handle: currentHandle, changed: false };

    const lastChangeIso = (profile.handleLastChangedAt ?? null) as string | null;
    assertCanChangeHandle({ nowIso: now, lastChangeIso });

    const nextRef = handlesCol.doc(nextHandle);
    const nextSnap = await tx.get(nextRef);
    if (nextSnap.exists) {
      const owner = String((nextSnap.data() as any)?.uid ?? '');
      if (owner !== viewer.uid) err('ALREADY_EXISTS', 'HANDLE_TAKEN');
    }

    tx.set(
      nextRef,
      {
        handle: nextHandle,
        uid: viewer.uid,
        createdAt: nextSnap.exists ? ((nextSnap.data() as any).createdAt ?? now) : now
      },
      { merge: true }
    );

    tx.set(profileRef, { handle: nextHandle, handleLastChangedAt: now, updatedAt: now }, { merge: true });

    if (currentHandle && currentHandle !== nextHandle) {
      const oldRef = handlesCol.doc(currentHandle);
      const oldSnap = await tx.get(oldRef);
      if (oldSnap.exists && String((oldSnap.data() as any)?.uid ?? '') === viewer.uid) {
        tx.delete(oldRef);
      }
    }

    return { handle: nextHandle, changed: true };
  });

  if (changed) {
    // Best-effort: keep posts' authorHandle in sync for nicer UX.
    // If this fails (e.g. missing index), the profile handle remains authoritative.
    try {
      let last: any | null = null;
      for (let i = 0; i < 25; i++) {
        let q = db().collection('posts').where('authorUid', '==', viewer.uid).orderBy('createdAt', 'desc').limit(200);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;

        const batch = db().batch();
        for (const doc of snap.docs) {
          batch.set(doc.ref, { authorHandle: handle, updatedAt: now }, { merge: true });
        }
        await batch.commit();
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 200) break;
      }
    } catch (e) {
      console.error('claimHandle: failed to update posts authorHandle', e);
    }
  }

  return { ok: true, handle };
});

export const approveFollower = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ followerUid: string }>(approveFollowerSchema, req.data);
  if (data.followerUid === viewer.uid) err('INVALID_ARGUMENT', 'CANNOT_APPROVE_SELF');

  const followerRef = db().collection('follows').doc(viewer.uid).collection('followers').doc(data.followerUid);
  const followingRef = db().collection('following').doc(data.followerUid).collection('targets').doc(viewer.uid);
  const viewerPublicRef = db().collection('publicProfiles').doc(viewer.uid);
  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const followerSnap = await tx.get(followerRef);
    if (!followerSnap.exists) err('NOT_FOUND', 'FOLLOW_REQUEST_NOT_FOUND');
    const prevStatus = (followerSnap.data() as any).status as string;
    if (prevStatus === 'approved') return;

    tx.set(followerRef, { status: 'approved', updatedAt: now }, { merge: true });
    tx.set(followingRef, { status: 'approved', updatedAt: now }, { merge: true });

    const viewerSnap = await tx.get(viewerPublicRef);
    if (viewerSnap.exists) {
      const current = Number((viewerSnap.data() as any).followerCount ?? 0);
      tx.update(viewerPublicRef, { followerCount: current + 1, updatedAt: now });
    }
  });

  return { ok: true };
});

export const removeFollower = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ followerUid: string }>(removeFollowerSchema, req.data);
  if (data.followerUid === viewer.uid) err('INVALID_ARGUMENT', 'CANNOT_REMOVE_SELF');

  const followerRef = db().collection('follows').doc(viewer.uid).collection('followers').doc(data.followerUid);
  const followingRef = db().collection('following').doc(data.followerUid).collection('targets').doc(viewer.uid);
  const viewerPublicRef = db().collection('publicProfiles').doc(viewer.uid);
  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(followerRef);
    if (!snap.exists) return;
    const prevStatus = ((snap.data() as any).status as string) ?? null;
    tx.delete(followerRef);
    tx.delete(followingRef);

    if (prevStatus === 'approved') {
      const viewerSnap = await tx.get(viewerPublicRef);
      if (viewerSnap.exists) {
        const current = Number((viewerSnap.data() as any).followerCount ?? 0);
        tx.update(viewerPublicRef, { followerCount: Math.max(0, current - 1), updatedAt: now });
      }
    }
  });

  return { ok: true };
});

export const unfollow = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ targetUid: string }>(unfollowSchema, req.data);
  if (data.targetUid === viewer.uid) err('INVALID_ARGUMENT', 'CANNOT_UNFOLLOW_SELF');

  const followerRef = db().collection('follows').doc(data.targetUid).collection('followers').doc(viewer.uid);
  const followingRef = db().collection('following').doc(viewer.uid).collection('targets').doc(data.targetUid);
  const targetPublicRef = db().collection('publicProfiles').doc(data.targetUid);
  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(followerRef);
    const prevStatus = snap.exists ? ((snap.data() as any).status as string) : null;
    if (snap.exists) tx.delete(followerRef);
    tx.delete(followingRef);

    if (prevStatus === 'approved') {
      const targetSnap = await tx.get(targetPublicRef);
      if (targetSnap.exists) {
        const current = Number((targetSnap.data() as any).followerCount ?? 0);
        tx.update(targetPublicRef, { followerCount: Math.max(0, current - 1), updatedAt: now });
      }
    }
  });

  return { ok: true };
});

export const createPost = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ caption: string; tags: string[]; visibility: PostVisibility }>(createPostSchema, req.data);

  const now = nowIso();
  await enforceRateLimit({
    uid: viewer.uid,
    action: 'createPost',
    nowIso: now,
    limits: [
      { window: 'minute', max: 3 },
      { window: 'day', max: 20 }
    ]
  });
  const viewerProfileSnap = await db().collection('publicProfiles').doc(viewer.uid).get();
  const authorIsPrivateAccount = viewerProfileSnap.exists ? !!(viewerProfileSnap.data() as any).isPrivateAccount : false;
  const ref = db().collection('posts').doc();
  const postId = ref.id;

  await ref.set({
    postId,
    authorUid: viewer.uid,
    authorHandle: viewer.handle,
    authorRoleLabel: viewer.role,
    authorIsPrivateAccount,
    caption: data.caption,
    tags: data.tags,
    visibility: data.visibility,
    mediaAssetIds: [],
    media: [],
    likeCount: 0,
    commentCount: 0,
    createdAt: now,
    updatedAt: now
  });

  return { ok: true, postId };
});

export const updatePost = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ postId: string; caption?: string; tags?: string[]; visibility?: PostVisibility }>(updatePostSchema, req.data);

  const postRef = db().collection('posts').doc(data.postId);
  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
    const post = snap.data() as any;

    if (post.deletedAt) err('NOT_FOUND', 'POST_NOT_FOUND');

    const authorUid = String(post.authorUid ?? '');
    if (!authorUid) err('NOT_FOUND', 'POST_NOT_FOUND');
    if (!viewer.isAdmin && authorUid !== viewer.uid) err('PERMISSION_DENIED', 'NOT_OWNER');

    const patch: Record<string, unknown> = { updatedAt: now };
    let hasChanges = false;

    if (typeof (data as any).caption !== 'undefined') {
      patch.caption = data.caption as string;
      hasChanges = true;
    }
    if (typeof (data as any).tags !== 'undefined') {
      patch.tags = data.tags as string[];
      hasChanges = true;
    }
    if (typeof (data as any).visibility !== 'undefined') {
      patch.visibility = data.visibility as PostVisibility;
      hasChanges = true;
    }

    if (!hasChanges) err('INVALID_ARGUMENT', 'NO_CHANGES');

    tx.set(postRef, patch, { merge: true });
  });

  return { ok: true };
});

export const deletePost = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ postId: string }>(deletePostSchema, req.data);

  const postRef = db().collection('posts').doc(data.postId);
  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
    const post = snap.data() as any;

    const authorUid = String(post.authorUid ?? '');
    if (!authorUid) err('NOT_FOUND', 'POST_NOT_FOUND');
    if (!viewer.isAdmin && authorUid !== viewer.uid) err('PERMISSION_DENIED', 'NOT_OWNER');

    if (post.deletedAt) return; // idempotent

    const mediaAssetIds: string[] = Array.isArray(post.mediaAssetIds) ? post.mediaAssetIds : [];
    for (const assetId of mediaAssetIds) {
      if (!assetId) continue;
      const assetRef = db().collection('mediaAssets').doc(String(assetId));
      tx.set(assetRef, { postId: null, updatedAt: now }, { merge: true });
    }

    tx.set(
      postRef,
      {
        deletedAt: now,
        deletedByUid: viewer.uid,
        updatedAt: now
      },
      { merge: true }
    );
  });

  return { ok: true };
});

export const createComment = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ postId: string; body: string; parentCommentId: string | null }>(createCommentSchema, req.data);

  const { postRef, authorUid } = await loadPostAccess({ viewerUid: viewer.uid, viewerIsAdmin: viewer.isAdmin, postId: data.postId });
  const now = nowIso();
  await enforceRateLimit({
    uid: viewer.uid,
    action: 'createComment',
    nowIso: now,
    limits: [
      { window: 'minute', max: 10 },
      { window: 'day', max: 200 }
    ]
  });
  await assertNotBlocked({ viewerUid: viewer.uid, targetUid: authorUid });
  const commentRef = postRef.collection('comments').doc();

  await db().runTransaction(async (tx) => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');

    tx.set(commentRef, {
      commentId: commentRef.id,
      postId: data.postId,
      authorUid: viewer.uid,
      authorHandle: viewer.handle,
      body: data.body,
      parentCommentId: data.parentCommentId ?? null,
      createdAt: now
    });

    const current = Number((postSnap.data() as any).commentCount ?? 0);
    tx.update(postRef, { commentCount: current + 1, updatedAt: now });
  });

  return { ok: true, commentId: commentRef.id };
});

export const deleteComment = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ postId: string; commentId: string }>(deleteCommentSchema, req.data);

  const { postRef, post } = await loadPostAccess({ viewerUid: viewer.uid, viewerIsAdmin: viewer.isAdmin, postId: data.postId });
  if (post.deletedAt) err('NOT_FOUND', 'POST_NOT_FOUND');

  const now = nowIso();
  const commentRef = postRef.collection('comments').doc(data.commentId);

  await db().runTransaction(async (tx) => {
    const [postSnap, commentSnap] = await Promise.all([tx.get(postRef), tx.get(commentRef)]);
    if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
    if (!commentSnap.exists) err('NOT_FOUND', 'COMMENT_NOT_FOUND');

    const c = commentSnap.data() as any;
    const commentAuthorUid = String(c.authorUid ?? '');
    const postAuthorUid = String((postSnap.data() as any).authorUid ?? '');

    const canDelete = viewer.isAdmin || viewer.uid === commentAuthorUid || viewer.uid === postAuthorUid;
    if (!canDelete) err('PERMISSION_DENIED', 'NOT_ALLOWED');

    tx.delete(commentRef);
    const current = Number((postSnap.data() as any).commentCount ?? 0);
    tx.update(postRef, { commentCount: Math.max(0, current - 1), updatedAt: now });
  });

  return { ok: true };
});

export const toggleLike = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const viewer = await getViewerContext(req);
  const data = validateOrThrow<{ postId: string; like: boolean }>(toggleLikeSchema, req.data);

  const { postRef, authorUid } = await loadPostAccess({ viewerUid: viewer.uid, viewerIsAdmin: viewer.isAdmin, postId: data.postId });
  const now = nowIso();
  await enforceRateLimit({ uid: viewer.uid, action: 'toggleLike', nowIso: now, limits: [{ window: 'minute', max: 30 }] });
  await assertNotBlocked({ viewerUid: viewer.uid, targetUid: authorUid });
  const likeRef = postRef.collection('likes').doc(viewer.uid);

  const nextCount = await db().runTransaction(async (tx) => {
    const [postSnap, likeSnap] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
    if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');

    const currentCount = Number((postSnap.data() as any).likeCount ?? 0);

    if (data.like) {
      if (!likeSnap.exists) {
        tx.set(likeRef, { uid: viewer.uid, createdAt: now });
        tx.update(postRef, { likeCount: currentCount + 1, updatedAt: now });
        return currentCount + 1;
      }
      return currentCount;
    }

    // unlike
    if (likeSnap.exists) {
      tx.delete(likeRef);
      tx.update(postRef, { likeCount: Math.max(0, currentCount - 1), updatedAt: now });
      return Math.max(0, currentCount - 1);
    }
    return currentCount;
  });

  return { ok: true, likeCount: nextCount };
});
