import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../init';
import { nowIso } from '../utils/firestore';
import { CONTRACT_AUTO_CANCEL_HOURS } from '../shared/constants';
import { createNotification } from '../utils/notifications';
import { STRIPE_SECRET_KEY } from '../config';
import { stripeClient } from '../utils/stripe';
import { activateContractFromPaidCheckoutSession } from '../utils/contracts';

export const cancelUnpaidContracts = onSchedule(
  { region: 'us-central1', schedule: 'every 60 minutes', secrets: [STRIPE_SECRET_KEY] },
  async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CONTRACT_AUTO_CANCEL_HOURS * 60 * 60 * 1000).toISOString();
  const nowStr = nowIso();

  const stripe = stripeClient(STRIPE_SECRET_KEY.value());

  const snaps = await db()
    .collection('contracts')
    .where('status', '==', 'pending_payment')
    .where('createdAt', '<', cutoff)
    .limit(200)
    .get();

  for (const doc of snaps.docs) {
    const contract = doc.data() as any;
    const contractId: string = contract.contractId ?? doc.id;

    try {
      // Reconcile with Stripe before cancelling: if the Checkout Session is paid, activate instead of cancel.
      const checkoutSessionId: string | null = contract?.stripe?.checkoutSessionId ? String(contract.stripe.checkoutSessionId) : null;
      if (checkoutSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
          if (session.payment_status === 'paid') {
            await activateContractFromPaidCheckoutSession({ contractId, session, activatedAt: nowStr });
            continue;
          }
        } catch (e) {
          // If Stripe is temporarily unavailable, do not cancel (avoid orphaning paid contracts).
          console.error('cancelUnpaidContracts: Stripe lookup failed; skipping cancellation for now', { contractId, checkoutSessionId }, e);
          continue;
        }
      }

      // Cancel contract
      await doc.ref.update({ status: 'cancelled', updatedAt: nowStr });

      // Expire deliverable if exists
      await db().collection('deliverables').doc(contractId).set({ status: 'expired', updatedAt: nowStr }, { merge: true });

      // Release campaign slot (avoid negatives; re-open if it was paused because full)
      const campaignRef = db().collection('campaigns').doc(contract.campaignId);
      await db().runTransaction(async (tx) => {
        const snap = await tx.get(campaignRef);
        if (!snap.exists) return;
        const c = snap.data() as any;
        const deliverablesTotal = Number(c?.deliverableSpec?.deliverablesTotal ?? 0);
        const currentAccepted = Number(c?.acceptedDeliverablesCount ?? 0);
        const nextAccepted = Math.max(0, currentAccepted - 1);

        const update: Record<string, any> = { acceptedDeliverablesCount: nextAccepted, updatedAt: nowStr };
        // Only auto-reopen campaigns that were auto-paused due to being full.
        if (c.status === 'paused' && c.autoPaused === true && nextAccepted < deliverablesTotal) {
          update.status = 'live';
          update.autoPaused = false;
        }
        tx.update(campaignRef, update);
      });

      await createNotification({
        toUid: contract.artistUid,
        type: 'admin_message',
        title: 'Contract cancelled',
        body: 'A contract was cancelled due to non-payment within 24 hours.',
        link: `/artist/contracts/${contractId}`
      });

      await createNotification({
        toUid: contract.creatorUid,
        type: 'admin_message',
        title: 'Contract cancelled',
        body: 'A contract was cancelled due to non-payment by the artist.',
        link: `/creator/contracts/${contractId}`
      });
    } catch (e) {
      console.error('cancelUnpaidContracts: failed to process contract', { contractId }, e);
    }
  }
  }
);
