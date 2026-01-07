import { onCall } from 'firebase-functions/v2/https';
import { bucket, db } from '../init';
import { requireEmailVerified, requireRole } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { createTrackSchema, registerTrackRightsDocSchema } from '../schemas/requests';
import { isUuid } from '../utils/ids';

type CreateReq = {
  trackId: string;
  title: string;
  artistName: string;
  genre: string;
  moodTags: string[];
  isrc: string | null;
  externalLinks: { spotify: string | null; appleMusic: string | null; youtube: string | null; tiktokSound: string | null };
  rightsTier: 'tier1_attestation' | 'tier2_verified';
  rightsAttestation: { attestsMasterRights: boolean; attestsPublishingRights: boolean; hasCoWritersOrSplits: boolean };
  rightsAttestationNotes: string | null;
  coverUploaded: boolean;
};

type RegisterRightsDocReq = { trackId: string; storagePath: string };

async function assertFileExists(path: string): Promise<void> {
  const file = bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) err('FAILED_PRECONDITION', 'FILE_MISSING', { path });
}

export const createTrack = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  await requireUserActive(uid);

  const data = validateOrThrow<CreateReq>(createTrackSchema, req.data);

  if (!isUuid(data.trackId)) err('INVALID_ARGUMENT', 'TRACK_ID_MUST_BE_UUID');

  const now = nowIso();
  const trackId = data.trackId;
  const previewPath = `tracks/${uid}/${trackId}/preview.mp3`;
  await assertFileExists(previewPath);

  let coverArtPath: string | null = null;
  if (data.coverUploaded) {
    coverArtPath = `tracks/${uid}/${trackId}/cover.jpg`;
    await assertFileExists(coverArtPath);
  }

  const trackRef = db().collection('tracks').doc(trackId);
  const privRef = db().collection('trackPrivate').doc(trackId);

  await db().runTransaction(async (tx) => {
    const existing = await tx.get(trackRef);
    if (existing.exists) err('ALREADY_EXISTS', 'TRACK_ALREADY_EXISTS');

    tx.set(trackRef, {
      trackId,
      ownerUid: uid,
      title: data.title,
      artistName: data.artistName,
      genre: data.genre,
      moodTags: data.moodTags,
      isrc: data.isrc ?? null,
      coverArtPath,
      externalLinks: data.externalLinks,
      rightsTier: data.rightsTier,
      rightsAttestation: {
        ...data.rightsAttestation,
        acceptedAt: now
      },
      rightsReview: {
        status: data.rightsTier === 'tier2_verified' ? 'pending' : 'not_required',
        reviewedBy: null,
        reviewedAt: null
      },
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

    tx.set(privRef, {
      trackId,
      ownerUid: uid,
      previewAudioPath: previewPath,
      rightsDocumentsPaths: [],
      rightsAttestationNotes: data.rightsAttestationNotes ?? null,
      rightsReviewNotes: null,
      createdAt: now,
      updatedAt: now
    });
  });

  return { ok: true, trackId };
});

export const registerTrackRightsDocument = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  await requireUserActive(uid);

  const data = validateOrThrow<RegisterRightsDocReq>(registerTrackRightsDocSchema, req.data);
  if (!isUuid(data.trackId)) err('INVALID_ARGUMENT', 'TRACK_ID_MUST_BE_UUID');

  const trackRef = db().collection('tracks').doc(data.trackId);
  const privRef = db().collection('trackPrivate').doc(data.trackId);

  // Basic ownership + path checks
  const expectedPrefix = `tracks/${uid}/${data.trackId}/rights/`;
  if (!data.storagePath.startsWith(expectedPrefix)) err('INVALID_ARGUMENT', 'RIGHTS_DOC_PATH_INVALID');

  await assertFileExists(data.storagePath);

  const now = nowIso();

  await db().runTransaction(async (tx) => {
    const [trackSnap, privSnap] = await Promise.all([tx.get(trackRef), tx.get(privRef)]);
    if (!trackSnap.exists || !privSnap.exists) err('NOT_FOUND', 'TRACK_NOT_FOUND');

    const track = trackSnap.data() as any;
    if (track.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');

    const priv = privSnap.data() as any;
    const arr: string[] = Array.isArray(priv.rightsDocumentsPaths) ? priv.rightsDocumentsPaths : [];
    if (!arr.includes(data.storagePath)) arr.push(data.storagePath);

    tx.update(privRef, { rightsDocumentsPaths: arr, updatedAt: now });

    // For tier2, keep review pending until admin decision
    if (track.rightsTier === 'tier2_verified') {
      tx.update(trackRef, { rightsReview: { ...track.rightsReview, status: 'pending' }, updatedAt: now });
    }
  });

  return { ok: true };
});
