import { db } from '../init';
import { nowIso } from './firestore';
import { suggestHandleCandidates, isValidHandle } from './handles';

export async function ensurePublicIdentity(params: {
  uid: string;
  displayNameOrEmail: string | null;
  preferGuest: boolean;
  roleLabel: string;
}): Promise<{ handle: string; displayName: string }> {
  const uid = params.uid;
  const publicProfilesCol = db().collection('publicProfiles');
  const handlesCol = db().collection('handles');

  const existing = await publicProfilesCol.doc(uid).get();
  if (existing.exists) {
    const d = existing.data() as any;
    if (d?.handle) return { handle: String(d.handle), displayName: String(d.displayName ?? 'User') };
  }

  const now = nowIso();
  const displayName = params.displayNameOrEmail?.trim() || (params.preferGuest ? 'Guest' : 'User');
  const candidates = suggestHandleCandidates({
    uid,
    displayNameOrEmail: params.displayNameOrEmail,
    preferGuest: params.preferGuest
  });

  const handle = await db().runTransaction(async (tx) => {
    const profileRef = publicProfilesCol.doc(uid);
    const profileSnap = await tx.get(profileRef);
    if (profileSnap.exists) {
      const d = profileSnap.data() as any;
      if (d?.handle) return String(d.handle);
    }

    for (const h of candidates) {
      const handleRef = handlesCol.doc(h);
      const handleSnap = await tx.get(handleRef);
      if (handleSnap.exists) continue;
      tx.set(handleRef, { handle: h, uid, createdAt: now });
      return h;
    }

    const fallbackBase = `guest_${uid.slice(0, 12).toLowerCase()}`;
    const fallback = isValidHandle(fallbackBase) ? fallbackBase : `guest_${uid.slice(0, 8).toLowerCase()}_${uid.slice(-4).toLowerCase()}`;
    tx.set(handlesCol.doc(fallback), { handle: fallback, uid, createdAt: now });
    return fallback;
  });

  await publicProfilesCol.doc(uid).set(
    {
      uid,
      handle,
      displayName,
      bio: null,
      roleLabel: params.roleLabel,
      avatarAssetId: null,
      isPrivateAccount: false,
      followerCount: 0,
      createdAt: now,
      updatedAt: now
    },
    { merge: true }
  );

  return { handle, displayName };
}

