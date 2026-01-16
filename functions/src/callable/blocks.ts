import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { assertSocialEnabled } from '../utils/flags';
import { blockUserSchema, muteUserSchema, unblockUserSchema, unmuteUserSchema } from '../schemas/requests';

type TargetReq = { targetUid: string };

export const blockUser = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<TargetReq>(blockUserSchema, req.data);
  if (data.targetUid === uid) err('INVALID_ARGUMENT', 'CANNOT_BLOCK_SELF');

  const now = nowIso();
  const ref = db().collection('blocks').doc(uid).collection('blocked').doc(data.targetUid);

  await ref.set({ targetUid: data.targetUid, createdAt: now }, { merge: true });

  // Best-effort: sever follow relationships in both directions.
  // This keeps follower-only content from being accessible due to previous approvals.
  try {
    const batch = db().batch();

    batch.delete(db().collection('following').doc(uid).collection('targets').doc(data.targetUid));
    batch.delete(db().collection('follows').doc(data.targetUid).collection('followers').doc(uid));

    batch.delete(db().collection('following').doc(data.targetUid).collection('targets').doc(uid));
    batch.delete(db().collection('follows').doc(uid).collection('followers').doc(data.targetUid));

    await batch.commit();
  } catch (e) {
    console.error('blockUser: failed to sever follow relationships', e);
  }

  return { ok: true };
});

export const unblockUser = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<TargetReq>(unblockUserSchema, req.data);
  if (data.targetUid === uid) err('INVALID_ARGUMENT', 'CANNOT_UNBLOCK_SELF');

  await db().collection('blocks').doc(uid).collection('blocked').doc(data.targetUid).delete();
  return { ok: true };
});

export const muteUser = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<TargetReq>(muteUserSchema, req.data);
  if (data.targetUid === uid) err('INVALID_ARGUMENT', 'CANNOT_MUTE_SELF');

  const now = nowIso();
  await db().collection('mutes').doc(uid).collection('muted').doc(data.targetUid).set({ targetUid: data.targetUid, createdAt: now }, { merge: true });
  return { ok: true };
});

export const unmuteUser = onCall({ region: 'us-central1' }, async (req) => {
  assertSocialEnabled();
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<TargetReq>(unmuteUserSchema, req.data);
  if (data.targetUid === uid) err('INVALID_ARGUMENT', 'CANNOT_UNMUTE_SELF');

  await db().collection('mutes').doc(uid).collection('muted').doc(data.targetUid).delete();
  return { ok: true };
});
