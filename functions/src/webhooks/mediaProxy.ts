import { onRequest } from 'firebase-functions/v2/https';
import { auth as adminAuth } from 'firebase-admin';
import { bucket, db, initAdmin } from '../init';
import { err } from '../utils/errors';
import { canViewerReadAsset } from '../utils/mediaAccess';
import { type PostVisibility } from '../utils/socialVisibility';
import { isSocialEnabled } from '../utils/flags';

function bearerToken(req: any): string | null {
  const h = (req.header('authorization') as string | undefined) ?? (req.header('Authorization') as string | undefined);
  if (!h) return null;
  const m = /^Bearer (.+)$/.exec(h);
  return m ? m[1] : null;
}

export const mediaProxy = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!isSocialEnabled()) {
    res.status(404).send('Not found');
    return;
  }

  const assetId = String(req.query.assetId ?? '').trim();
  if (!assetId) {
    res.status(400).send('Missing assetId');
    return;
  }

  // Determine viewer (optional). For public posts, token is not required.
  let viewerUid: string | null = null;
  let viewerIsAdmin = false;

  const token = bearerToken(req);
  if (token) {
    try {
      initAdmin();
      const decoded = await adminAuth().verifyIdToken(token);
      viewerUid = decoded.uid;
      viewerIsAdmin = (decoded as any).role === 'admin';
    } catch {
      // Treat invalid token as anonymous viewer.
      viewerUid = null;
      viewerIsAdmin = false;
    }
  }

  try {
    const assetSnap = await db().collection('mediaAssets').doc(assetId).get();
    if (!assetSnap.exists) err('NOT_FOUND', 'ASSET_NOT_FOUND');
    const asset = assetSnap.data() as any;
    const postId: string | null = asset.postId ?? null;
    if (!postId) err('NOT_FOUND', 'ASSET_NOT_FOUND');

    const postSnap = await db().collection('posts').doc(postId).get();
    if (!postSnap.exists) err('NOT_FOUND', 'POST_NOT_FOUND');
    const post = postSnap.data() as any;

    // Followers/private enforcement.
    let viewerIsApprovedFollower = false;
    if (viewerUid) {
      const followerSnap = await db().collection('follows').doc(post.authorUid).collection('followers').doc(viewerUid).get();
      viewerIsApprovedFollower = followerSnap.exists && (followerSnap.data() as any).status === 'approved';
    }

    const canRead = canViewerReadAsset({
      viewerUid,
      viewerIsAdmin,
      viewerIsApprovedFollower,
      authorUid: post.authorUid,
      authorIsPrivateAccount: !!post.authorIsPrivateAccount,
      postVisibility: post.visibility as PostVisibility
    });

    if (!canRead) {
      // Hidden private content: act like missing.
      res.status(404).send('Not found');
      return;
    }

    const file = bucket().file(String(asset.storagePath));
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send('Not found');
      return;
    }

    const [meta] = await file.getMetadata();
    const contentType = String(meta.contentType ?? asset.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Type', contentType);

    // Cache strategy:
    // - Public post + public account: cache aggressively (still served through proxy).
    // - Anything else: no-store.
    const isPublic = post.visibility === 'public' && post.authorIsPrivateAccount !== true;
    res.setHeader('Cache-Control', isPublic ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400' : 'private, no-store');

    file.createReadStream()
      .on('error', () => {
        res.status(404).send('Not found');
      })
      .pipe(res);
  } catch (e: any) {
    // Map our err() to HTTP
    const code = e?.code ?? '';
    if (code === 'NOT_FOUND') {
      res.status(404).send('Not found');
      return;
    }
    res.status(500).send('Internal error');
  }
});
