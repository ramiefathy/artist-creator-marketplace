import * as functions from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-admin/auth';
import { ADMIN_EMAIL_ALLOWLIST } from '../config';
import { auth, db } from '../init';
import { nowIso } from '../utils/firestore';

function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export const authOnCreateUser = functions.region('us-central1').auth.user().onCreate(async (user: UserRecord) => {
  const uid = user.uid;
  const email = (user.email ?? '').trim();
  const allowlist = parseAllowlist(ADMIN_EMAIL_ALLOWLIST.value());
  const role = email && allowlist.includes(email.toLowerCase()) ? 'admin' : 'unassigned';

  // Set claims
  await auth().setCustomUserClaims(uid, { role });

  const now = nowIso();
  await db().collection('users').doc(uid).set({
    uid,
    email: email || '',
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now
  });

  // Create baseline profiles for both sides so subsequent callables can assume existence.
  // Users choose their role later via setInitialRole, but we keep both documents present.
  const defaultName = user.displayName || email.split('@')[0] || 'User';

  await db().collection('artistProfiles').doc(uid).set(
    {
      uid,
      displayName: defaultName,
      entityType: 'individual',
      country: 'US',
      timezone: 'Etc/UTC',
      ratingAvg: 0,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  await db().collection('creatorProfiles').doc(uid).set(
    {
      uid,
      displayName: defaultName,
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
    },
    { merge: true }
  );
});
