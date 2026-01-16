import * as functions from 'firebase-functions/v1';
import type { UserRecord } from 'firebase-admin/auth';
import { ADMIN_EMAIL_ALLOWLIST } from '../config';
import { auth, db } from '../init';
import { nowIso } from '../utils/firestore';
import { suggestHandleCandidates } from '../utils/handles';

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
  const isLikelyAnonymous = !user.email && !user.displayName && (user.providerData?.length ?? 0) === 0;
  const defaultName = user.displayName || email.split('@')[0] || (isLikelyAnonymous ? 'Guest' : 'User');

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

  // Public SEO identity: stable handle + public profile projection.
  // This is safe to expose publicly (no sensitive fields).
  const candidates = suggestHandleCandidates({
    uid,
    displayNameOrEmail: user.displayName || (email ? email.split('@')[0] : null),
    preferGuest: isLikelyAnonymous
  });

  const handlesCol = db().collection('handles');
  const publicProfilesCol = db().collection('publicProfiles');

  const chosenHandle = await db().runTransaction(async (tx) => {
    // If the user already has a public profile (shouldn't happen on first create), reuse it.
    const existingProfile = await tx.get(publicProfilesCol.doc(uid));
    if (existingProfile.exists) {
      const h = (existingProfile.data() as any)?.handle as string | undefined;
      if (h) return h;
    }

    for (const handle of candidates) {
      const handleRef = handlesCol.doc(handle);
      const snap = await tx.get(handleRef);
      if (snap.exists) continue;
      tx.set(handleRef, { handle, uid, createdAt: now });
      return handle;
    }

    // Worst-case fallback: deterministic, uid-tied handle.
    const fallback = `guest_${uid.slice(0, 12).toLowerCase()}`;
    const fallbackRef = handlesCol.doc(fallback);
    const fallbackSnap = await tx.get(fallbackRef);
    if (!fallbackSnap.exists) {
      tx.set(fallbackRef, { handle: fallback, uid, createdAt: now });
      return fallback;
    }

    // If even fallback collides (extremely unlikely), suffix with last 4 chars.
    const fallback2 = `guest_${uid.slice(0, 8).toLowerCase()}_${uid.slice(-4).toLowerCase()}`;
    tx.set(handlesCol.doc(fallback2), { handle: fallback2, uid, createdAt: now });
    return fallback2;
  });

  await publicProfilesCol.doc(uid).set(
    {
      uid,
      handle: chosenHandle,
      displayName: defaultName,
      bio: null,
      roleLabel: isLikelyAnonymous ? 'guest' : role,
      avatarAssetId: null,
      isPrivateAccount: false,
      followerCount: 0,
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );
});
