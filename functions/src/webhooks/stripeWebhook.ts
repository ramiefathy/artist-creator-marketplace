import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config';
import { db } from '../init';
import { nowIso } from '../utils/firestore';
import { stripeClient, assertStripeWebhookSignature } from '../utils/stripe';
import { createNotification } from '../utils/notifications';

export const stripeWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]
  },
  async (req, res) => {
    const stripe = stripeClient(STRIPE_SECRET_KEY.value());

    let event: Stripe.Event;
    try {
      event = assertStripeWebhookSignature({
        stripe,
        payload: req.rawBody as Buffer,
        sigHeader: req.header('stripe-signature') ?? undefined,
        webhookSecret: STRIPE_WEBHOOK_SECRET.value()
      });
    } catch (e: any) {
      res.status(400).send(`Webhook signature verification failed: ${e?.message ?? 'unknown'}`);
      return;
    }

    const eventId = event.id;
    const now = nowIso();

    // Idempotency guard
    const eventRef = db().collection('stripeEvents').doc(eventId);
    const alreadyProcessed = await db().runTransaction(async (tx) => {
      const snap = await tx.get(eventRef);
      if (snap.exists) return true;
      tx.set(eventRef, {
        eventId,
        type: event.type,
        processedAt: now,
        createdAt: now
      });
      return false;
    });

    if (alreadyProcessed) {
      res.status(200).json({ received: true, deduped: true });
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const contractId = session.metadata?.contractId;
        if (!contractId) {
          res.status(200).json({ received: true, ignored: 'missing_contractId' });
          return;
        }

        if (session.payment_status !== 'paid') {
          res.status(200).json({ received: true, ignored: 'not_paid' });
          return;
        }

        const contractRef = db().collection('contracts').doc(contractId);
        const contractSnap = await contractRef.get();
        if (!contractSnap.exists) {
          res.status(200).json({ received: true, ignored: 'contract_missing' });
          return;
        }

        const contract = contractSnap.data() as any;
        if (contract.stripe?.paymentStatus === 'paid') {
          res.status(200).json({ received: true, ignored: 'already_paid' });
          return;
        }
        if (contract.status === 'cancelled') {
          res.status(200).json({ received: true, ignored: 'contract_cancelled' });
          return;
        }

        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

        // Activate contract + set due date relative to activation
        const dueDays = contract.snapshots?.campaign?.deliverableSpec?.dueDaysAfterActivation;
        const dueAt = new Date(Date.now() + (Number(dueDays ?? 7) * 24 * 60 * 60 * 1000)).toISOString();

        await contractRef.update({
          status: 'active',
          activatedAt: now,
          stripe: {
            ...contract.stripe,
            checkoutSessionId: session.id,
            paymentIntentId,
            paymentStatus: 'paid'
          },
          updatedAt: now
        });

        const deliverableRef = db().collection('deliverables').doc(contractId);
        const deliverableSnap = await deliverableRef.get();
        if (deliverableSnap.exists) {
          await deliverableRef.update({ dueAt, updatedAt: now });
        }

        await createNotification({
          toUid: contract.artistUid,
          type: 'payment_received',
          title: 'Payment received',
          body: 'Payment was received. The creator can now proceed with the deliverable.',
          link: `/artist/contracts/${contractId}`
        });

        await createNotification({
          toUid: contract.creatorUid,
          type: 'payment_received',
          title: 'Contract activated',
          body: 'Payment was received. You may proceed with posting the deliverable.',
          link: `/creator/contracts/${contractId}`
        });
      }

      if (event.type === 'checkout.session.expired') {
        const session = event.data.object as Stripe.Checkout.Session;
        const contractId = (session.metadata as any)?.contractId;
        if (contractId) {
          const contractRef = db().collection('contracts').doc(contractId);
          const snap = await contractRef.get();
          if (snap.exists) {
            const contract = snap.data() as any;
            if (contract.status === 'pending_payment') {
              const now = nowIso();
              await contractRef.update({ status: 'cancelled', updatedAt: now });

              await db().collection('deliverables').doc(contractId).set({ status: 'expired', updatedAt: now }, { merge: true });

              // Release campaign slot
              const campaignRef = db().collection('campaigns').doc(contract.campaignId);
              await db().runTransaction(async (tx) => {
                const cSnap = await tx.get(campaignRef);
                if (!cSnap.exists) return;
                const c = cSnap.data() as any;
                const total = c.deliverableSpec?.deliverablesTotal ?? 0;
                const current = c.acceptedDeliverablesCount ?? 0;
                const nextAccepted = Math.max(0, current - 1);
                const update: Record<string, any> = { acceptedDeliverablesCount: nextAccepted, updatedAt: now };
                if (c.status === 'paused' && c.autoPaused === true && nextAccepted < total) {
                  update.status = 'live';
                  update.autoPaused = false;
                }
                tx.update(campaignRef, update);
              });

              await createNotification({
                toUid: contract.artistUid,
                type: 'contract_cancelled',
                title: 'Checkout session expired',
                body: 'The payment session expired. The contract slot was released.',
                link: `/artist/contracts/${contractId}`
              });
              await createNotification({
                toUid: contract.creatorUid,
                type: 'contract_cancelled',
                title: 'Contract cancelled',
                body: 'The artist did not complete payment in time. The contract was cancelled.',
                link: `/creator/contracts/${contractId}`
              });
            }
          }
        }
      }

      if (event.type === 'charge.refunded') {
        const charge = event.data.object as Stripe.Charge;
        let contractId: string | null = ((charge.metadata as any)?.contractId as string | undefined) ?? null;

        // Fallback: resolve by payment intent id (most reliable for our integration)
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
        if (!contractId && paymentIntentId) {
          const q = await db().collection('contracts').where('stripe.paymentIntentId', '==', paymentIntentId).limit(1).get();
          if (!q.empty) contractId = q.docs[0].id;
        }

        if (contractId) {
          const contractRef = db().collection('contracts').doc(contractId);
          const snap = await contractRef.get();
          if (snap.exists) {
            const c = snap.data() as any;
            const amount = (charge.amount as number) ?? 0;
            const amountRefunded = (charge.amount_refunded as number) ?? 0;
            const nextPaymentStatus = amountRefunded >= amount ? 'refunded' : amountRefunded > 0 ? 'partial_refund' : (c.stripe?.paymentStatus ?? 'paid');
            await contractRef.update({
              stripe: { ...c.stripe, paymentStatus: nextPaymentStatus },
              updatedAt: now
            });
          }
        }
      }
    } catch (e: any) {
      // We already wrote the stripeEvents doc; return 200 to avoid Stripe retries storm.
      res.status(200).json({ received: true, error: e?.message ?? 'unknown' });
      return;
    }

    res.status(200).json({ received: true });
  }
);
