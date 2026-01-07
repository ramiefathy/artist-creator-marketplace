import { onCall } from 'firebase-functions/v2/https';
import { bucket, db } from '../init';
import { requireEmailVerified, requireRole } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { submitDeliverableSchema, artistDecisionSchema } from '../schemas/requests';
import { createNotification } from '../utils/notifications';
import { payoutCreatorForContract } from '../utils/payout';
import { STRIPE_SECRET_KEY } from '../config';

type SubmitReq = {
  deliverableId: string;
  postUrl: string;
  creatorNotes: string | null;
  compliance: { disclosureConfirmed: true; licenseConfirmed: true; postLiveDaysConfirmed: true };
  metrics24h: { views: number; likes: number; comments: number; shares: number; saves: number } | null;
  evidencePaths: string[];
};

async function assertEvidenceExists(paths: string[]): Promise<void> {
  for (const p of paths) {
    const [exists] = await bucket().file(p).exists();
    if (!exists) err('FAILED_PRECONDITION', 'EVIDENCE_FILE_MISSING', { path: p });
  }
}

export const submitDeliverable = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid: creatorUid } = requireRole(req, ['creator']);
  await requireUserActive(creatorUid);

  const data = validateOrThrow<SubmitReq>(submitDeliverableSchema, req.data);
  const now = nowIso();

  const delivRef = db().collection('deliverables').doc(data.deliverableId);
  const delivSnap = await delivRef.get();
  if (!delivSnap.exists) err('NOT_FOUND', 'DELIVERABLE_NOT_FOUND');

  const d = delivSnap.data() as any;
  if (d.creatorUid !== creatorUid) err('PERMISSION_DENIED', 'NOT_OWNER');
  if (!['pending', 'revision_requested'].includes(d.status)) err('FAILED_PRECONDITION', 'NOT_SUBMITTABLE');

  const contractSnap = await db().collection('contracts').doc(d.contractId).get();
  if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const contract = contractSnap.data() as any;
  if (contract.status !== 'active') err('FAILED_PRECONDITION', 'CONTRACT_NOT_ACTIVE');
  if (contract.stripe?.paymentStatus !== 'paid') err('FAILED_PRECONDITION', 'CONTRACT_NOT_PAID');

  // evidence path validation
  for (const p of data.evidencePaths) {
    const prefix = `deliverableEvidence/${data.deliverableId}/${d.artistUid}/${creatorUid}/`;
    if (!p.startsWith(prefix)) err('INVALID_ARGUMENT', 'EVIDENCE_PATH_INVALID');
  }
  await assertEvidenceExists(data.evidencePaths);

  await delivRef.update({
    status: 'submitted',
    submission: {
      postUrl: data.postUrl,
      submittedAt: now,
      creatorNotes: data.creatorNotes ?? null,
      compliance: data.compliance,
      evidencePaths: data.evidencePaths,
      metrics24h: data.metrics24h ?? null
    },
    updatedAt: now
  });

  await createNotification({
    toUid: d.artistUid,
    type: 'deliverable_submitted',
    title: 'Deliverable submitted',
    body: 'A creator submitted a deliverable for review.',
    link: `/artist/contracts/${d.contractId}`
  });

  return { ok: true };
});

export const artistApproveDeliverable = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY] },
  async (req) => {
    requireEmailVerified(req);
    const { uid: artistUid } = requireRole(req, ['artist']);
    await requireUserActive(artistUid);

    const data = validateOrThrow<{ deliverableId: string; notes: string | null }>(artistDecisionSchema('approve'), req.data);
    const now = nowIso();

    const delivRef = db().collection('deliverables').doc(data.deliverableId);
    const delivSnap = await delivRef.get();
    if (!delivSnap.exists) err('NOT_FOUND', 'DELIVERABLE_NOT_FOUND');

    const d = delivSnap.data() as any;
    if (d.artistUid !== artistUid) err('PERMISSION_DENIED', 'NOT_OWNER');
    if (d.status !== 'submitted') err('FAILED_PRECONDITION', 'NOT_REVIEWABLE');

    const contractRef = db().collection('contracts').doc(d.contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
    const contract = contractSnap.data() as any;
    if (contract.status !== 'active') err('FAILED_PRECONDITION', 'CONTRACT_NOT_ACTIVE');
    if (contract.stripe?.paymentStatus !== 'paid') err('FAILED_PRECONDITION', 'CONTRACT_NOT_PAID');

    await delivRef.update({
      status: 'approved',
      review: {
        artistDecision: 'approved',
        artistNotes: data.notes ?? null,
        reviewedAt: now
      },
      updatedAt: now
    });

    // Payout + contract completion (idempotent)
    await payoutCreatorForContract(d.contractId);

    await createNotification({
      toUid: d.artistUid,
      type: 'deliverable_approved',
      title: 'Deliverable approved',
      body: 'You approved a deliverable and the payout has been initiated.',
      link: `/artist/contracts/${d.contractId}`
    });

    await createNotification({
      toUid: d.creatorUid,
      type: 'deliverable_approved',
      title: 'Deliverable approved',
      body: 'Your deliverable was approved. Payout will be processed via Stripe Connect.',
      link: `/creator/contracts/${d.contractId}`
    });

    return { ok: true };
  }
);

export const artistRequestRevision = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid: artistUid } = requireRole(req, ['artist']);
  await requireUserActive(artistUid);

  const data = validateOrThrow<{ deliverableId: string; notes: string }>(artistDecisionSchema('revision'), req.data);
  const now = nowIso();

  const delivRef = db().collection('deliverables').doc(data.deliverableId);
  const delivSnap = await delivRef.get();
  if (!delivSnap.exists) err('NOT_FOUND', 'DELIVERABLE_NOT_FOUND');
  const d = delivSnap.data() as any;
  if (d.artistUid !== artistUid) err('PERMISSION_DENIED', 'NOT_OWNER');
  if (d.status !== 'submitted') err('FAILED_PRECONDITION', 'NOT_REVIEWABLE');

  const contractSnap = await db().collection('contracts').doc(d.contractId).get();
  if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const contract = contractSnap.data() as any;
  if (contract.status !== 'active') err('FAILED_PRECONDITION', 'CONTRACT_NOT_ACTIVE');
  if (contract.stripe?.paymentStatus !== 'paid') err('FAILED_PRECONDITION', 'CONTRACT_NOT_PAID');

  await delivRef.update({
    status: 'revision_requested',
    review: {
      artistDecision: 'revision_requested',
      artistNotes: data.notes,
      reviewedAt: now
    },
    updatedAt: now
  });

  await createNotification({
    toUid: d.creatorUid,
    type: 'deliverable_revision',
    title: 'Revision requested',
    body: data.notes,
    link: `/creator/contracts/${d.contractId}`
  });

  return { ok: true };
});

export const artistRejectDeliverable = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid: artistUid } = requireRole(req, ['artist']);
  await requireUserActive(artistUid);

  const data = validateOrThrow<{ deliverableId: string; notes: string }>(artistDecisionSchema('reject'), req.data);
  const now = nowIso();

  const delivRef = db().collection('deliverables').doc(data.deliverableId);
  const delivSnap = await delivRef.get();
  if (!delivSnap.exists) err('NOT_FOUND', 'DELIVERABLE_NOT_FOUND');
  const d = delivSnap.data() as any;
  if (d.artistUid !== artistUid) err('PERMISSION_DENIED', 'NOT_OWNER');
  if (d.status !== 'submitted') err('FAILED_PRECONDITION', 'NOT_REVIEWABLE');

  const contractRef = db().collection('contracts').doc(d.contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const contract = contractSnap.data() as any;
  if (contract.status !== 'active') err('FAILED_PRECONDITION', 'CONTRACT_NOT_ACTIVE');
  if (contract.stripe?.paymentStatus !== 'paid') err('FAILED_PRECONDITION', 'CONTRACT_NOT_PAID');

  await delivRef.update({
    status: 'rejected',
    review: {
      artistDecision: 'rejected',
      artistNotes: data.notes,
      reviewedAt: now
    },
    updatedAt: now
  });

  // Mark contract disputed to require explicit dispute resolution (refund/no refund) by admins.
  await contractRef.update({ status: 'disputed', updatedAt: now });

  await createNotification({
    toUid: d.creatorUid,
    type: 'deliverable_rejected',
    title: 'Deliverable rejected',
    body: data.notes,
    link: `/creator/contracts/${d.contractId}`
  });

  await createNotification({
    toUid: d.artistUid,
    type: 'admin_message',
    title: 'Contract moved to dispute',
    body: 'Because the deliverable was rejected, the contract is now marked disputed. Open a dispute to request a refund (if applicable).',
    link: `/artist/contracts/${d.contractId}`
  });

  return { ok: true };
});
