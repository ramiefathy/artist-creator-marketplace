import { onCall } from 'firebase-functions/v2/https';
import { bucket, db } from '../init';
import { requireEmailVerified, requireRole, requireAdmin } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { requestCreatorVerificationSchema, adminSetCreatorVerificationSchema } from '../schemas/requests';
import { createNotification } from '../utils/notifications';

type RequestReq = { evidencePaths: string[]; notes: string | null };
type AdminReq = { creatorUid: string; status: 'verified' | 'rejected'; notes?: string | null };

function assertEvidencePath(uid: string, path: string) {
  if (!path.startsWith(`creatorEvidence/${uid}/`)) {
    err('INVALID_ARGUMENT', 'EVIDENCE_PATH_INVALID');
  }
}

async function assertStorageObjectsExist(paths: string[]): Promise<void> {
  for (const p of paths) {
    const file = bucket().file(p);
    const [exists] = await file.exists();
    if (!exists) err('FAILED_PRECONDITION', 'EVIDENCE_FILE_MISSING', { path: p });
  }
}

export const requestCreatorVerification = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['creator']);
  await requireUserActive(uid);

  const data = validateOrThrow<RequestReq>(requestCreatorVerificationSchema, req.data);
  for (const p of data.evidencePaths) assertEvidencePath(uid, p);
  await assertStorageObjectsExist(data.evidencePaths);

  const now = nowIso();
  const pubRef = db().collection('creatorProfiles').doc(uid);
  const privRef = db().collection('creatorPrivate').doc(uid);

  await db().runTransaction(async (tx) => {
    const pubSnap = await tx.get(pubRef);
    const privSnap = await tx.get(privRef);
    if (!pubSnap.exists || !privSnap.exists) err('FAILED_PRECONDITION', 'PROFILE_MISSING');

    const pub = pubSnap.data() as any;
    if (pub.verificationStatus === 'verified') err('FAILED_PRECONDITION', 'ALREADY_VERIFIED');
    if (pub.verificationStatus === 'pending') err('FAILED_PRECONDITION', 'ALREADY_PENDING');

    tx.update(pubRef, { verificationStatus: 'pending', updatedAt: now });
    tx.update(privRef, {
      metricsEvidencePaths: data.evidencePaths,
      verificationNotes: data.notes ?? null,
      verificationRequestedAt: now,
      verificationReviewedAt: null,
      verificationReviewedBy: null,
      updatedAt: now
    });
  });

  // Notify all admins
  const adminSnaps = await db().collection('users').where('role', '==', 'admin').where('status', '==', 'active').get();
  await Promise.all(
    adminSnaps.docs.map((d) =>
      createNotification({
        toUid: d.id,
        type: 'verification_requested',
        title: 'Creator verification requested',
        body: `Creator ${uid} requested verification.`,
        link: `/admin/creators/${uid}`
      })
    )
  );

  return { ok: true };
});

export const adminSetCreatorVerification = onCall({ region: 'us-central1' }, async (req) => {
  const { uid: adminUid } = requireAdmin(req);
  await requireUserActive(adminUid);

  const data = validateOrThrow<AdminReq>(adminSetCreatorVerificationSchema, req.data);
  const now = nowIso();

  const pubRef = db().collection('creatorProfiles').doc(data.creatorUid);
  const privRef = db().collection('creatorPrivate').doc(data.creatorUid);

  await db().runTransaction(async (tx) => {
    const pubSnap = await tx.get(pubRef);
    const privSnap = await tx.get(privRef);
    if (!pubSnap.exists || !privSnap.exists) err('NOT_FOUND', 'CREATOR_NOT_FOUND');

    tx.update(pubRef, { verificationStatus: data.status, updatedAt: now });
    tx.update(privRef, {
      verificationReviewedAt: now,
      verificationReviewedBy: adminUid,
      verificationNotes: data.notes ?? null,
      updatedAt: now
    });
  });

  await createNotification({
    toUid: data.creatorUid,
    type: 'verification_decision',
    title: 'Verification decision',
    body: data.status === 'verified' ? 'You are now verified.' : 'Your verification request was rejected.',
    link: '/creator/profile'
  });

  return { ok: true };
});
