import Stripe from 'stripe';
import { db } from '../init';
import { nowIso } from './firestore';
import { createNotification } from './notifications';

function dueAtFromActivation(params: { activatedAt: string; dueDays: unknown }): string {
  const dueDaysNum = Number(params.dueDays);
  const dueDays = Number.isFinite(dueDaysNum) && dueDaysNum > 0 ? dueDaysNum : 7;
  const activatedMs = new Date(params.activatedAt).getTime();
  return new Date(activatedMs + dueDays * 24 * 60 * 60 * 1000).toISOString();
}

export type ActivateContractOutcome = 'activated' | 'already_paid' | 'ignored_refunded';

/**
 * Activates a contract after confirming Stripe Checkout payment succeeded.
 *
 * - Idempotent: if already paid, returns `already_paid`.
 * - Safety: if contract is refunded/partially refunded, does not re-activate.
 * - If the contract was cancelled while unpaid, this attempts to restore the campaign slot and reset an expired deliverable.
 */
export async function activateContractFromPaidCheckoutSession(params: {
  contractId: string;
  session: Stripe.Checkout.Session;
  activatedAt?: string;
}): Promise<ActivateContractOutcome> {
  const activatedAt = params.activatedAt ?? nowIso();
  const contractId = params.contractId;

  const contractRef = db().collection('contracts').doc(contractId);
  const deliverableRef = db().collection('deliverables').doc(contractId);

  const result = await db().runTransaction(async (tx) => {
    const contractSnap = await tx.get(contractRef);
    if (!contractSnap.exists) {
      throw new Error('CONTRACT_NOT_FOUND');
    }

    const contract = contractSnap.data() as any;
    const previousPaymentStatus: string = contract?.stripe?.paymentStatus ?? 'unpaid';

    // Do not re-activate refunded contracts.
    if (previousPaymentStatus === 'refunded' || previousPaymentStatus === 'partial_refund') {
      return { outcome: 'ignored_refunded' as const, contract };
    }

    // Idempotency: already paid is a no-op.
    if (previousPaymentStatus === 'paid') {
      return { outcome: 'already_paid' as const, contract };
    }

    const paymentIntentId = typeof params.session.payment_intent === 'string' ? params.session.payment_intent : null;

    const dueAt = dueAtFromActivation({
      activatedAt,
      dueDays: contract?.snapshots?.campaign?.deliverableSpec?.dueDaysAfterActivation
    });

    tx.update(contractRef, {
      status: 'active',
      activatedAt,
      stripe: {
        ...contract.stripe,
        checkoutSessionId: params.session.id,
        paymentIntentId,
        paymentStatus: 'paid'
      },
      updatedAt: activatedAt
    });

    const deliverableSnap = await tx.get(deliverableRef);
    if (deliverableSnap.exists) {
      const deliverable = deliverableSnap.data() as any;
      const deliverableUpdate: Record<string, any> = { dueAt, updatedAt: activatedAt };
      if (deliverable.status === 'expired') {
        deliverableUpdate.status = 'pending';
      }
      tx.update(deliverableRef, deliverableUpdate);
    }

    // If this contract was cancelled while unpaid (e.g. auto-cancel job ran), restore campaign capacity.
    const wasCancelledWhileUnpaid =
      contract.status === 'cancelled' && (previousPaymentStatus === 'unpaid' || previousPaymentStatus === 'failed');
    if (wasCancelledWhileUnpaid) {
      const campaignId: string | null = contract.campaignId ?? null;
      if (campaignId) {
        const campaignRef = db().collection('campaigns').doc(campaignId);
        const campaignSnap = await tx.get(campaignRef);
        if (campaignSnap.exists) {
          const c = campaignSnap.data() as any;
          const total = Number(c?.deliverableSpec?.deliverablesTotal ?? 0);
          const current = Number(c?.acceptedDeliverablesCount ?? 0);
          const nextAccepted = current + 1;

          const update: Record<string, any> = { acceptedDeliverablesCount: nextAccepted, updatedAt: activatedAt };
          // Mirror acceptOffer behavior: auto-pause when full.
          if (c.status === 'live' && nextAccepted >= total) {
            update.status = 'paused';
            update.autoPaused = true;
          }
          tx.update(campaignRef, update);
        }
      }
    }

    return { outcome: 'activated' as const, contract };
  });

  if (result.outcome === 'activated') {
    // Notifications are best-effort; activation should not fail because of them.
    try {
      await createNotification({
        toUid: result.contract.artistUid,
        type: 'payment_received',
        title: 'Payment received',
        body: 'Payment was received. The creator can now proceed with the deliverable.',
        link: `/artist/contracts/${contractId}`
      });

      await createNotification({
        toUid: result.contract.creatorUid,
        type: 'payment_received',
        title: 'Contract activated',
        body: 'Payment was received. You may proceed with posting the deliverable.',
        link: `/creator/contracts/${contractId}`
      });
    } catch (e) {
      console.error('activateContractFromPaidCheckoutSession: notification failure', { contractId }, e);
    }
  }

  return result.outcome;
}

