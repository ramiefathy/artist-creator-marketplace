import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../init';
import { requireAdmin } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { adminSetUserStatusSchema, adminChangeUserRoleSchema } from '../schemas/requests';
import { createNotification } from '../utils/notifications';

type SetStatusReq = { uid: string; status: 'active' | 'suspended' };
type ChangeRoleReq = { uid: string; role: 'artist' | 'creator' | 'admin' };

export const adminSetUserStatus = onCall({ region: 'us-central1' }, async (req) => {
  const { uid: adminUid } = requireAdmin(req);
  await requireUserActive(adminUid);

  const data = validateOrThrow<SetStatusReq>(adminSetUserStatusSchema, req.data);
  const now = nowIso();

  const userRef = db().collection('users').doc(data.uid);
  const snap = await userRef.get();
  if (!snap.exists) err('NOT_FOUND', 'USER_NOT_FOUND');

  await userRef.update({ status: data.status, updatedAt: now });

  await createNotification({
    toUid: data.uid,
    type: 'admin_message',
    title: 'Account status updated',
    body: `Your account status is now: ${data.status}.`,
    link: '/me'
  });

  return { ok: true };
});

export const adminChangeUserRole = onCall({ region: 'us-central1' }, async (req) => {
  const { uid: adminUid } = requireAdmin(req);
  await requireUserActive(adminUid);

  const data = validateOrThrow<ChangeRoleReq>(adminChangeUserRoleSchema, req.data);
  const now = nowIso();

  const userRef = db().collection('users').doc(data.uid);
  const snap = await userRef.get();
  if (!snap.exists) err('NOT_FOUND', 'USER_NOT_FOUND');

  await userRef.update({ role: data.role, updatedAt: now });
  await auth().setCustomUserClaims(data.uid, { role: data.role });

  // Ensure the minimum per-role documents exist so the user can immediately use the app.
  const user = snap.data() as any;
  const defaultName = user.displayName || (user.email ? String(user.email).split('@')[0] : 'User');
  if (data.role === 'artist') {
    const artistRef = db().collection('artistProfiles').doc(data.uid);
    const artistSnap = await artistRef.get();
    const existing = artistSnap.exists ? (artistSnap.data() as any) : {};

    await artistRef.set(
      {
        uid: data.uid,
        displayName: existing.displayName ?? defaultName,
        entityType: existing.entityType ?? 'individual',
        country: existing.country ?? 'US',
        timezone: existing.timezone ?? 'Etc/UTC',
        ratingAvg: existing.ratingAvg ?? 0,
        ratingCount: existing.ratingCount ?? 0,
        createdAt: existing.createdAt ?? now,
        updatedAt: now
      },
      { merge: true }
    );
  }
  if (data.role === 'creator') {
    const creatorRef = db().collection('creatorProfiles').doc(data.uid);
    const creatorSnap = await creatorRef.get();
    const existing = creatorSnap.exists ? (creatorSnap.data() as any) : {};

    await creatorRef.set(
      {
        uid: data.uid,
        displayName: existing.displayName ?? defaultName,
        bio: existing.bio ?? null,
        niches: Array.isArray(existing.niches) && existing.niches.length > 0 ? existing.niches : ['music'],
        platformHandles: existing.platformHandles ?? { tiktok: null, instagram: null, youtube: null },
        audienceCountries: Array.isArray(existing.audienceCountries) ? existing.audienceCountries : [],
        metricsSelfReported: existing.metricsSelfReported ?? {
          tiktokFollowers: 0,
          tiktokAvgViews: 0,
          instagramFollowers: 0,
          instagramAvgViews: 0,
          youtubeSubscribers: 0,
          youtubeAvgViews: 0
        },
        verificationStatus: existing.verificationStatus ?? 'unverified',
        ratingAvg: existing.ratingAvg ?? 0,
        ratingCount: existing.ratingCount ?? 0,
        createdAt: existing.createdAt ?? now,
        updatedAt: now
      },
      { merge: true }
    );

    const privRef = db().collection('creatorPrivate').doc(data.uid);
    const privSnap = await privRef.get();
    const existingPriv = privSnap.exists ? (privSnap.data() as any) : {};

    await privRef.set(
      {
        uid: data.uid,
        metricsEvidencePaths: Array.isArray(existingPriv.metricsEvidencePaths) ? existingPriv.metricsEvidencePaths : [],
        verificationNotes: existingPriv.verificationNotes ?? null,
        verificationRequestedAt: existingPriv.verificationRequestedAt ?? null,
        verificationReviewedAt: existingPriv.verificationReviewedAt ?? null,
        verificationReviewedBy: existingPriv.verificationReviewedBy ?? null,
        stripeConnect: {
          accountId: existingPriv.stripeConnect?.accountId ?? null,
          onboardingStatus: existingPriv.stripeConnect?.onboardingStatus ?? 'not_started'
        },
        createdAt: existingPriv.createdAt ?? now,
        updatedAt: now
      },
      { merge: true }
    );
  }

  await createNotification({
    toUid: data.uid,
    type: 'admin_message',
    title: 'Role updated',
    body: `Your role is now: ${data.role}.`,
    link: '/me'
  });

  return { ok: true };
});
