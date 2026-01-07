import { onCall } from 'firebase-functions/v2/https';
import { bucket, db } from '../init';
import { requireEmailVerified, requireRole, requireAdmin } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { openDisputeSchema, adminResolveDisputeSchema } from '../schemas/requests';
import { createNotification } from '../utils/notifications';
import { stripeClient } from '../utils/stripe';
import { STRIPE_SECRET_KEY } from '../config';

type OpenReq = { contractId: string; reasonCode: string; description: string; evidencePaths: string[] };
type ResolveReq = { disputeId: string; outcome: 'resolved_refund' | 'resolved_no_refund' | 'resolved_partial_refund'; refundCents: number; notes: string };

async function assertEvidencePathsExist(paths: string[]): Promise<void> {
  for (const p of paths) {
    const [exists] = await bucket().file(p).exists();
    if (!exists) err('FAILED_PRECONDITION', 'EVIDENCE_FILE_MISSING', { path: p });
  }
}

export const openDispute = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid, role } = requireRole(req, ['artist', 'creator']);
  await requireUserActive(uid);

  const data = validateOrThrow<OpenReq>(openDisputeSchema, req.data);
  const now = nowIso();

  const contractRef = db().collection('contracts').doc(data.contractId);
  const contractSnap = await contractRef.get();
  if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const contract = contractSnap.data() as any;

  if (![contract.artistUid, contract.creatorUid].includes(uid)) err('PERMISSION_DENIED', 'NOT_PARTY');

  // evidence path validation
  for (const p of data.evidencePaths) {
    const prefix = `disputeEvidence/${data.contractId}/${uid}/`;
    if (!p.startsWith(prefix)) err('INVALID_ARGUMENT', 'EVIDENCE_PATH_INVALID');
  }
  await assertEvidencePathsExist(data.evidencePaths);

  const disputeRef = db().collection('disputes').doc();
  const disputeId = disputeRef.id;

  await disputeRef.set({
    disputeId,
    contractId: data.contractId,
    artistUid: contract.artistUid,
    creatorUid: contract.creatorUid,
    openedByUid: uid,
    openedByRole: role,
    reasonCode: data.reasonCode,
    description: data.description,
    evidencePaths: data.evidencePaths,
    status: 'open',
    resolution: {
      adminUid: null,
      notes: null,
      refundCents: 0,
      resolvedAt: null
    },
    createdAt: now,
    updatedAt: now
  });

  await contractRef.update({ status: 'disputed', updatedAt: now });

  const otherUid = uid === contract.artistUid ? contract.creatorUid : contract.artistUid;
  await createNotification({
    toUid: otherUid,
    type: 'dispute_opened',
    title: 'Dispute opened',
    body: 'A dispute was opened for a contract you are part of.',
    link: `/${uid === contract.artistUid ? 'creator' : 'artist'}/contracts/${data.contractId}`
  });

  // Notify admins
  const admins = await db().collection('users').where('role', '==', 'admin').where('status', '==', 'active').get();
  await Promise.all(
    admins.docs.map((d) =>
      createNotification({
        toUid: d.id,
        type: 'dispute_opened',
        title: 'Dispute opened',
        body: `Dispute ${disputeId} opened for contract ${data.contractId}.`,
        link: `/admin/disputes/${disputeId}`
      })
    )
  );

  return { ok: true, disputeId };
});

export const adminResolveDispute = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY] },
  async (req) => {
    const { uid: adminUid } = requireAdmin(req);
    await requireUserActive(adminUid);

    const data = validateOrThrow<ResolveReq>(adminResolveDisputeSchema, req.data);
    const now = nowIso();

    const disputeRef = db().collection('disputes').doc(data.disputeId);
    const disputeSnap = await disputeRef.get();
    if (!disputeSnap.exists) err('NOT_FOUND', 'DISPUTE_NOT_FOUND');
    const dispute = disputeSnap.data() as any;

    if (!['open', 'under_review'].includes(dispute.status)) err('FAILED_PRECONDITION', 'DISPUTE_NOT_OPEN');

    const contractRef = db().collection('contracts').doc(dispute.contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
    const contract = contractSnap.data() as any;

    const total = contract.pricing.totalPriceCents as number;
    const refund = data.refundCents;

    // If a payout was already sent, we cannot safely auto-refund using Stripe without additional
    // bookkeeping / negative balances on the connected account. Require manual handling.
    if (refund > 0 && contract?.payout?.transferStatus === 'sent') {
      err('FAILED_PRECONDITION', 'PAYOUT_ALREADY_SENT');
    }

    if (refund > 0 && contract?.stripe?.paymentStatus !== 'paid') {
      err('FAILED_PRECONDITION', 'CONTRACT_NOT_PAID');
    }

    if (data.outcome === 'resolved_no_refund' && refund !== 0) err('INVALID_ARGUMENT', 'REFUND_MUST_BE_ZERO');
    if (data.outcome === 'resolved_refund' && refund !== total) err('INVALID_ARGUMENT', 'REFUND_MUST_EQUAL_TOTAL');
    if (data.outcome === 'resolved_partial_refund' && (refund <= 0 || refund >= total))
      err('INVALID_ARGUMENT', 'REFUND_MUST_BE_PARTIAL');

    // Process refund if needed
    let paymentStatus = contract.stripe.paymentStatus as string;
    if (refund > 0) {
      const paymentIntentId = contract.stripe.paymentIntentId as string | null;
      if (!paymentIntentId) err('FAILED_PRECONDITION', 'PAYMENT_INTENT_MISSING');

      const stripe = stripeClient(STRIPE_SECRET_KEY.value());
      await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: refund,
          metadata: { disputeId: data.disputeId, contractId: dispute.contractId }
        },
        { idempotencyKey: `refund_${data.disputeId}` }
      );

      paymentStatus = refund === total ? 'refunded' : 'partial_refund';
      await contractRef.update({
        stripe: { ...contract.stripe, paymentStatus },
        updatedAt: now
      });
    }

    // Update dispute + contract status
    await disputeRef.update({
      status: data.outcome,
      resolution: {
        adminUid,
        notes: data.notes,
        refundCents: refund,
        resolvedAt: now
      },
      updatedAt: now
    });

    const contractStatus = refund === total ? 'cancelled' : contract.status === 'disputed' ? 'active' : contract.status;
    await contractRef.update({ status: contractStatus, updatedAt: now });

    await createNotification({
      toUid: dispute.artistUid,
      type: 'dispute_resolved',
      title: 'Dispute resolved',
      body: `Outcome: ${data.outcome}. Refund: $${(refund / 100).toFixed(2)}.`,
      link: `/artist/contracts/${dispute.contractId}`
    });

    await createNotification({
      toUid: dispute.creatorUid,
      type: 'dispute_resolved',
      title: 'Dispute resolved',
      body: `Outcome: ${data.outcome}. Refund: $${(refund / 100).toFixed(2)}.`,
      link: `/creator/contracts/${dispute.contractId}`
    });

    return { ok: true };
  }
);
