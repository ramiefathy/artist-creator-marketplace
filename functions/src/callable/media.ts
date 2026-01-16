import { onCall } from 'firebase-functions/v2/https';
import { bucket, db } from '../init';
import { requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { validateOrThrow } from '../utils/validation';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { initiateMediaUploadSchema, finalizeMediaUploadSchema, attachMediaToPostSchema } from '../schemas/requests';
import { assertDeclaredUploadOk, normalizeFilename, assertUploadPathMatches, type MediaKind } from '../utils/media';
import { ensurePublicIdentity } from '../utils/publicIdentity';
import { assertSocialEnabled } from '../utils/flags';
import { enforceRateLimit } from '../utils/rateLimit';

function isAnonymousProvider(req: any): boolean {
  const provider = (req?.auth?.token as any)?.firebase?.sign_in_provider;
  return provider === 'anonymous';
}

async function ensureHandle(req: any, uid: string, role: string): Promise<string> {
  const preferGuest = isAnonymousProvider(req);
  const displayNameOrEmail = (req.auth?.token as any)?.name ?? (req.auth?.token as any)?.email ?? null;
  const ident = await ensurePublicIdentity({
    uid,
    displayNameOrEmail,
    preferGuest,
    roleLabel: role === 'unassigned' && preferGuest ? 'guest' : role
  });
  return ident.handle;
}

type InitiateReq = { kind: MediaKind; mimeType: string; sizeBytes: number; originalFilename: string };

export const initiateMediaUpload = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<InitiateReq>(initiateMediaUploadSchema, req.data);
  assertDeclaredUploadOk({ kind: data.kind, mimeType: data.mimeType, sizeBytes: data.sizeBytes });

  const now = nowIso();
  await enforceRateLimit({ uid, action: 'initiateMediaUpload', nowIso: now, limits: [{ window: 'day', max: 20 }] });

  await ensureHandle(req, uid, role);

  const uploadRef = db().collection('mediaUploads').doc();
  const uploadId = uploadRef.id;
  const filename = normalizeFilename(data.originalFilename);
  const storagePath = `socialUploads/${uid}/${uploadId}/${filename}`;

  await uploadRef.set({
    uploadId,
    ownerUid: uid,
    kind: data.kind,
    declared: { mimeType: data.mimeType, sizeBytes: data.sizeBytes, filename },
    storagePath,
    status: 'initiated',
    assetId: null,
    createdAt: now,
    updatedAt: now
  });

  return { ok: true, uploadId, storagePath, filename };
});

export const finalizeMediaUpload = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ uploadId: string }>(finalizeMediaUploadSchema, req.data);
  const now = nowIso();
  await enforceRateLimit({ uid, action: 'finalizeMediaUpload', nowIso: now, limits: [{ window: 'day', max: 20 }] });
  await ensureHandle(req, uid, role);

  const uploadRef = db().collection('mediaUploads').doc(data.uploadId);
  const uploadSnap = await uploadRef.get();
  if (!uploadSnap.exists) err('NOT_FOUND', 'UPLOAD_NOT_FOUND');
  const upload = uploadSnap.data() as any;

  if (upload.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');
  if (upload.status !== 'initiated') {
    // Idempotent: if already finalized, return same asset id.
    if (upload.status === 'finalized' && upload.assetId) return { ok: true, assetId: upload.assetId as string };
    err('FAILED_PRECONDITION', 'UPLOAD_NOT_INITIATED');
  }

  const kind = upload.kind as MediaKind;
  const declaredMime = String(upload.declared?.mimeType ?? '');
  const declaredBytes = Number(upload.declared?.sizeBytes ?? 0);
  const filename = String(upload.declared?.filename ?? 'file');
  const storagePath = String(upload.storagePath ?? '');

  assertDeclaredUploadOk({ kind, mimeType: declaredMime, sizeBytes: declaredBytes });
  assertUploadPathMatches({ uid, uploadId: data.uploadId, filename, storagePath });

  const tmpFile = bucket().file(storagePath);
  const [exists] = await tmpFile.exists();
  if (!exists) err('FAILED_PRECONDITION', 'UPLOAD_FILE_MISSING');

  const [meta] = await tmpFile.getMetadata();
  const actualBytes = Number(meta.size ?? 0);
  const actualMime = String(meta.contentType ?? '').toLowerCase();

  if (!actualBytes || actualBytes <= 0) err('FAILED_PRECONDITION', 'UPLOAD_METADATA_MISSING');
  if (actualBytes > declaredBytes * 1.05 + 1024) err('FAILED_PRECONDITION', 'UPLOAD_SIZE_MISMATCH');
  if (actualMime && actualMime !== declaredMime.toLowerCase()) err('FAILED_PRECONDITION', 'UPLOAD_MIME_MISMATCH');

  const assetRef = db().collection('mediaAssets').doc();
  const assetId = assetRef.id;
  const finalFilename = filename;
  const finalPath = `socialMedia/${assetId}/${finalFilename}`;

  // Copy to server-controlled path and delete temp.
  await tmpFile.copy(bucket().file(finalPath), {
    metadata: {
      contentType: declaredMime,
      cacheControl: 'private, max-age=0'
    }
  });
  await tmpFile.delete({ ignoreNotFound: true });

  await assetRef.set({
    assetId,
    ownerUid: uid,
    kind,
    mimeType: declaredMime,
    sizeBytes: actualBytes,
    filename: finalFilename,
    storagePath: finalPath,
    postId: null,
    createdAt: now
  });

  await uploadRef.set({ status: 'finalized', assetId, updatedAt: now }, { merge: true });

  return { ok: true, assetId };
});

export const attachMediaToPost = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);
  await ensureHandle(req, uid, role);

  const data = validateOrThrow<{ postId: string; assetId: string }>(attachMediaToPostSchema, req.data);

  const postRef = db().collection('posts').doc(data.postId);
  const assetRef = db().collection('mediaAssets').doc(data.assetId);
  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const [postSnap, assetSnap] = await Promise.all([tx.get(postRef), tx.get(assetRef)]);
    if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
    if (!assetSnap.exists) err('NOT_FOUND', 'ASSET_NOT_FOUND');

    const post = postSnap.data() as any;
    if (post.authorUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');

    const asset = assetSnap.data() as any;
    if (asset.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');
    if (asset.postId && asset.postId !== data.postId) err('FAILED_PRECONDITION', 'ASSET_ALREADY_ATTACHED');

    const mediaAssetIds: string[] = Array.isArray(post.mediaAssetIds) ? post.mediaAssetIds : [];
    if (!mediaAssetIds.includes(data.assetId)) mediaAssetIds.push(data.assetId);

    const media: any[] = Array.isArray(post.media) ? post.media : [];
    if (!media.some((m) => m && m.assetId === data.assetId)) {
      media.push({ assetId: data.assetId, kind: asset.kind, mimeType: asset.mimeType });
    }

    if (mediaAssetIds.length > 10) err('FAILED_PRECONDITION', 'TOO_MANY_MEDIA');

    tx.update(postRef, { mediaAssetIds, media, updatedAt: now });
    tx.update(assetRef, { postId: data.postId });
  });

  return { ok: true };
});
