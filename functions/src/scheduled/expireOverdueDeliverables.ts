import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../init';
import { nowIso } from '../utils/firestore';
import { createNotification } from '../utils/notifications';
import { stripeClient } from '../utils/stripe';
import { STRIPE_SECRET_KEY } from '../config';

/**
 * Expire overdue deliverables and (optionally) auto-refund if:
 * - Contract is active
 * - Payment is paid
 * - No payout transfer has been sent
 *
 * Rationale: the platform holds funds in escrow until delivery.
 */
export const expireOverdueDeliverables = onSchedule(
  { region: 'us-central1', schedule: 'every day 03:00', secrets: [STRIPE_SECRET_KEY] },
  async () => {
    const nowStr = nowIso();

    // Only consider deliverables that are not yet submitted.
    const snaps = await db().collection('deliverables').where('status', 'in', ['pending', 'revision_requested']).limit(200).get();

    for (const doc of snaps.docs) {
      const d = doc.data() as any;
      const dueAt: string = d.dueAt;
      if (!dueAt || dueAt >= nowStr) continue;

      const contractRef = db().collection('contracts').doc(d.contractId);
      const campaignRef = db().collection('campaigns').doc(d.campaignId);

      // Load contract + campaign for state checks / slot release.
      const [contractSnap, campaignSnap] = await Promise.all([contractRef.get(), campaignRef.get()]);
      if (!contractSnap.exists) continue;
      const contract = contractSnap.data() as any;

      // If the contract is not in a state that we can auto-refund, stop here.
      const paymentStatus = contract?.stripe?.paymentStatus as string | undefined;
      const transferStatus = contract?.payout?.transferStatus as string | undefined;

      // Only expire once the contract is active and paid (due date is set on activation).
      if (contract.status !== 'active' || paymentStatus !== 'paid') continue;

      // Mark deliverable expired (idempotent)
      await doc.ref.update({ status: 'expired', updatedAt: nowStr });

      const canAutoRefund = contract.status === 'active' && paymentStatus === 'paid' && transferStatus !== 'sent';
      if (!canAutoRefund) {
        await createNotification({
          toUid: d.creatorUid,
          type: 'admin_message',
          title: 'Deliverable expired',
          body: 'A deliverable has passed its due date and is marked expired. Contact the artist if needed.',
          link: `/creator/contracts/${d.contractId}`
        });

        await createNotification({
          toUid: d.artistUid,
          type: 'admin_message',
          title: 'Deliverable overdue',
          body: 'A deliverable is past due and was marked expired. If you want a refund, open a dispute.',
          link: `/artist/contracts/${d.contractId}`
        });
        continue;
      }

      // Auto-cancel + refund.
      const paymentIntentId = contract?.stripe?.paymentIntentId as string | null;
      const totalCents = contract?.pricing?.totalPriceCents as number | undefined;
      if (!paymentIntentId || !totalCents) {
        // If we cannot refund programmatically, mark contract disputed (manual handling).
        await contractRef.update({ status: 'disputed', updatedAt: nowStr });
        await createNotification({
          toUid: d.artistUid,
          type: 'admin_message',
          title: 'Manual review required',
          body: 'A deliverable expired, but the platform could not automatically refund this contract. An admin must review.',
          link: `/artist/contracts/${d.contractId}`
        });
        continue;
      }

      const stripe = stripeClient(STRIPE_SECRET_KEY.value());

      try {
        await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            amount: totalCents,
            metadata: { contractId: d.contractId, reason: 'deliverable_expired_auto_refund' }
          },
          { idempotencyKey: `auto_refund_expired_${d.contractId}` }
        );
      } catch (e: any) {
        // If refund fails, keep contract disputed for manual handling.
        await contractRef.update({ status: 'disputed', updatedAt: nowStr });
        await createNotification({
          toUid: d.artistUid,
          type: 'admin_message',
          title: 'Auto-refund failed',
          body: `A deliverable expired, but auto-refund failed (${e?.message ?? 'unknown'}). An admin must review.`,
          link: `/artist/contracts/${d.contractId}`
        });
        continue;
      }

      // Update contract state
      await contractRef.update({
        status: 'cancelled',
        stripe: { ...contract.stripe, paymentStatus: 'refunded' },
        updatedAt: nowStr
      });

      // Release campaign slot if possible
      if (campaignSnap.exists) {
        const campaign = campaignSnap.data() as any;
        const deliverablesTotal = campaign?.deliverableSpec?.deliverablesTotal ?? 0;

        await db().runTransaction(async (tx) => {
          const snap = await tx.get(campaignRef);
          if (!snap.exists) return;
          const c = snap.data() as any;
          const currentAccepted = Number(c.acceptedDeliverablesCount ?? 0);
          const nextAccepted = Math.max(0, currentAccepted - 1);

          const update: Record<string, any> = {
            acceptedDeliverablesCount: nextAccepted,
            updatedAt: nowStr
          };

          // Only auto-reopen campaigns that were auto-paused due to being full.
          if (c.status === 'paused' && c.autoPaused === true && nextAccepted < deliverablesTotal) {
            update.status = 'live';
            update.autoPaused = false;
          }

          tx.update(campaignRef, update);
        });
      }

      await createNotification({
        toUid: d.creatorUid,
        type: 'admin_message',
        title: 'Contract cancelled',
        body: 'The deliverable expired and the contract was cancelled. Payment was refunded to the artist.',
        link: `/creator/contracts/${d.contractId}`
      });

      await createNotification({
        toUid: d.artistUid,
        type: 'admin_message',
        title: 'Auto-refund issued',
        body: 'The deliverable expired and the platform issued an automatic refund. The contract is cancelled.',
        link: `/artist/contracts/${d.contractId}`
      });
    }
  }
);
