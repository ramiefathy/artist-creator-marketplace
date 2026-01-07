import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireEmailVerified, requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { byIdSchema } from '../schemas/requests';
import { getSignedReadUrl } from '../utils/signedUrl';
import { nowIso } from '../utils/firestore';

type UrlListRes = { ok: true; urls: string[]; paths: string[] };

export const getTrackPreviewUrl = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ trackId: string }>(byIdSchema('trackId'), req.data);

  const privSnap = await db().collection('trackPrivate').doc(data.trackId).get();
  if (!privSnap.exists) err('NOT_FOUND', 'TRACK_NOT_FOUND');
  const priv = privSnap.data() as any;

  const isOwner = priv.ownerUid === uid;

  // Access policy:
  // - Admin: always allowed
  // - Artist: only if owner
  // - Creator: allowed only if the track is attached to at least one LIVE campaign
  //           OR the creator is already a party to a contract for this track.
  if (role === 'admin') {
    // allowed
  } else if (role === 'artist') {
    if (!isOwner) err('PERMISSION_DENIED', 'ACCESS_DENIED');
  } else if (role === 'creator') {
    const [liveCampaigns, creatorContracts] = await Promise.all([
      db().collection('campaigns').where('trackId', '==', data.trackId).where('status', '==', 'live').limit(1).get(),
      db().collection('contracts').where('creatorUid', '==', uid).where('trackId', '==', data.trackId).limit(1).get()
    ]);
    if (liveCampaigns.empty && creatorContracts.empty) err('PERMISSION_DENIED', 'ACCESS_DENIED');
  } else {
    // unassigned / unknown
    if (!isOwner) err('PERMISSION_DENIED', 'ACCESS_DENIED');
  }

  const url = await getSignedReadUrl(priv.previewAudioPath, 10);
  return { ok: true, url };
});

export const getContractPdfUrl = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ contractId: string }>(byIdSchema('contractId'), req.data);

  const snap = await db().collection('contracts').doc(data.contractId).get();
  if (!snap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const c = snap.data() as any;

  const isParty = c.artistUid === uid || c.creatorUid === uid;
  if (!isParty && role !== 'admin') err('PERMISSION_DENIED', 'ACCESS_DENIED');

  const url = await getSignedReadUrl(c.contractPdfPath, 10);
  return { ok: true, url };
});

export const getDeliverableEvidenceUrls = onCall({ region: 'us-central1' }, async (req): Promise<UrlListRes> => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ deliverableId: string }>(byIdSchema('deliverableId'), req.data);
  const snap = await db().collection('deliverables').doc(data.deliverableId).get();
  if (!snap.exists) err('NOT_FOUND', 'DELIVERABLE_NOT_FOUND');
  const d = snap.data() as any;

  const isParty = d.artistUid === uid || d.creatorUid === uid;
  if (!isParty && role !== 'admin') err('PERMISSION_DENIED', 'ACCESS_DENIED');

  const paths: string[] = Array.isArray(d.submission?.evidencePaths) ? (d.submission.evidencePaths as string[]) : [];
  const urls = await Promise.all(paths.map((p) => getSignedReadUrl(p, 10)));
  return { ok: true, urls, paths };
});

export const getDisputeEvidenceUrls = onCall({ region: 'us-central1' }, async (req): Promise<UrlListRes> => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ disputeId: string }>(byIdSchema('disputeId'), req.data);
  const snap = await db().collection('disputes').doc(data.disputeId).get();
  if (!snap.exists) err('NOT_FOUND', 'DISPUTE_NOT_FOUND');
  const d = snap.data() as any;

  const isParty = d.artistUid === uid || d.creatorUid === uid;
  if (!isParty && role !== 'admin') err('PERMISSION_DENIED', 'ACCESS_DENIED');

  const paths: string[] = Array.isArray(d.evidencePaths) ? (d.evidencePaths as string[]) : [];
  const urls = await Promise.all(paths.map((p) => getSignedReadUrl(p, 10)));
  return { ok: true, urls, paths };
});

export const markNotificationRead = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<{ notificationId: string }>(byIdSchema('notificationId'), req.data);

  const ref = db().collection('notifications').doc(data.notificationId);
  const snap = await ref.get();
  if (!snap.exists) err('NOT_FOUND', 'NOTIFICATION_NOT_FOUND');

  const n = snap.data() as any;
  if (n.toUid !== uid && role !== 'admin') err('PERMISSION_DENIED', 'ACCESS_DENIED');

  await ref.update({ read: true, readAt: nowIso() });

  return { ok: true };
});


export const adminGetCreatorEvidenceUrls = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);
  if (role !== 'admin') err('PERMISSION_DENIED', 'ADMIN_ONLY');

  const data = validateOrThrow<{ creatorUid: string }>(byIdSchema('creatorUid'), req.data);

  const privSnap = await db().collection('creatorPrivate').doc(data.creatorUid).get();
  if (!privSnap.exists) err('NOT_FOUND', 'CREATOR_NOT_FOUND');

  const priv = privSnap.data() as any;
  const paths: string[] = Array.isArray(priv.metricsEvidencePaths) ? priv.metricsEvidencePaths : [];

  const urls = await Promise.all(paths.map((p) => getSignedReadUrl(p, 10)));

  return { ok: true, urls, paths };
});
