import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireEmailVerified, requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { leaveReviewSchema } from '../schemas/requests';
import { createNotification } from '../utils/notifications';

type Req = { contractId: string; rating: 1 | 2 | 3 | 4 | 5; text: string | null };

function updateAggregate(currentAvg: number, currentCount: number, newRating: number): { avg: number; count: number } {
  const count = currentCount + 1;
  const avg = (currentAvg * currentCount + newRating) / count;
  return { avg: Math.round(avg * 100) / 100, count };
}

export const leaveReview = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<Req>(leaveReviewSchema, req.data);
  const now = nowIso();

  const contractSnap = await db().collection('contracts').doc(data.contractId).get();
  if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const contract = contractSnap.data() as any;

  if (![contract.artistUid, contract.creatorUid].includes(uid)) err('PERMISSION_DENIED', 'NOT_PARTY');
  if (contract.status !== 'completed') err('FAILED_PRECONDITION', 'CONTRACT_NOT_COMPLETED');

  const fromRole = uid === contract.artistUid ? 'artist' : 'creator';
  const toUid = uid === contract.artistUid ? contract.creatorUid : contract.artistUid;

  // Prevent duplicates
  const existing = await db()
    .collection('reviews')
    .where('contractId', '==', data.contractId)
    .where('fromUid', '==', uid)
    .limit(1)
    .get();
  if (!existing.empty) err('ALREADY_EXISTS', 'REVIEW_ALREADY_LEFT');

  const reviewRef = db().collection('reviews').doc();
  const reviewId = reviewRef.id;

  await db().runTransaction(async (tx) => {
    tx.set(reviewRef, {
      reviewId,
      contractId: data.contractId,
      fromUid: uid,
      toUid,
      fromRole,
      rating: data.rating,
      text: data.text ?? null,
      createdAt: now
    });

    const toProfileRef = fromRole === 'artist' ? db().collection('creatorProfiles').doc(toUid) : db().collection('artistProfiles').doc(toUid);
    const toProfileSnap = await tx.get(toProfileRef);
    if (toProfileSnap.exists) {
      const p = toProfileSnap.data() as any;
      const agg = updateAggregate(p.ratingAvg ?? 0, p.ratingCount ?? 0, data.rating);
      tx.update(toProfileRef, { ratingAvg: agg.avg, ratingCount: agg.count, updatedAt: now });
    }
  });

  await createNotification({
    toUid,
    type: 'admin_message',
    title: 'New review',
    body: `You received a ${data.rating}-star review.`,
    link: fromRole === 'artist' ? '/creator/profile' : '/artist/profile'
  });

  return { ok: true, reviewId };
});
