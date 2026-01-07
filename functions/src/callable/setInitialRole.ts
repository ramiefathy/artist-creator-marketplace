import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from '../init';
import { requireAuth, requireEmailVerified } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { setInitialRoleSchema } from '../schemas/requests';

type Req = { role: 'artist' | 'creator' };
type Res = { ok: true; role: 'artist' | 'creator' };

export const setInitialRole = onCall({ region: 'us-central1' }, async (req): Promise<Res> => {
  requireEmailVerified(req);
  const { uid, role: existingClaimRole, email } = requireAuth(req);
  await requireUserActive(uid);

  if (existingClaimRole && existingClaimRole !== 'unassigned') {
    err('FAILED_PRECONDITION', 'ROLE_ALREADY_SET');
  }

  const data = validateOrThrow<Req>(setInitialRoleSchema, req.data);

  const now = nowIso();
  const userRef = db().collection('users').doc(uid);

  await db().runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) err('NOT_FOUND', 'USER_NOT_FOUND');

    const user = userSnap.data() as any;
    if (user.role && user.role !== 'unassigned') err('FAILED_PRECONDITION', 'ROLE_ALREADY_SET');

    tx.update(userRef, { role: data.role, updatedAt: now });

    if (data.role === 'artist') {
      const artistRef = db().collection('artistProfiles').doc(uid);
      const artistPrivRef = db().collection('artistPrivate').doc(uid);

      tx.set(artistRef, {
        uid,
        displayName: (email?.split('@')[0] ?? 'Artist').slice(0, 60),
        entityType: 'individual',
        country: 'US',
        timezone: 'Etc/UTC',
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: now,
        updatedAt: now
      });

      tx.set(artistPrivRef, {
        uid,
        stripeCustomerId: null,
        createdAt: now,
        updatedAt: now
      });
    }

    if (data.role === 'creator') {
      const creatorRef = db().collection('creatorProfiles').doc(uid);
      const creatorPrivRef = db().collection('creatorPrivate').doc(uid);

      tx.set(creatorRef, {
        uid,
        displayName: (email?.split('@')[0] ?? 'Creator').slice(0, 60),
        bio: null,
        niches: ['music'],
        platformHandles: { tiktok: null, instagram: null, youtube: null },
        audienceCountries: [],
        metricsSelfReported: {
          tiktokFollowers: 0,
          tiktokAvgViews: 0,
          instagramFollowers: 0,
          instagramAvgViews: 0,
          youtubeSubscribers: 0,
          youtubeAvgViews: 0
        },
        verificationStatus: 'unverified',
        ratingAvg: 0,
        ratingCount: 0,
        createdAt: now,
        updatedAt: now
      });

      tx.set(creatorPrivRef, {
        uid,
        metricsEvidencePaths: [],
        verificationNotes: null,
        verificationRequestedAt: null,
        verificationReviewedAt: null,
        verificationReviewedBy: null,
        stripeConnect: { accountId: null, onboardingStatus: 'not_started' },
        createdAt: now,
        updatedAt: now
      });
    }
  });

  await auth().setCustomUserClaims(uid, { role: data.role });

  return { ok: true, role: data.role };
});
