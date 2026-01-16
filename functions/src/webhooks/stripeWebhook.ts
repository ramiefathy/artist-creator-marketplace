import { onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config';
import { db } from '../init';
import { nowIso } from '../utils/firestore';
import { stripeClient, assertStripeWebhookSignature } from '../utils/stripe';
import { activateContractFromPaidCheckoutSession } from '../utils/contracts';
import { createNotification } from '../utils/notifications';

const STRIPE_EVENT_LOCK_TTL_MS = 10 * 60 * 1000;

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

    // Idempotency + retry safety:
    // - Create/update stripeEvents with status=received before processing.
    // - Mark status=processed/ignored on success.
    // - Mark status=error and return non-2xx on failure so Stripe retries.
    // - Use a short lock to avoid concurrent duplicate processing.
    const eventRef = db().collection('stripeEvents').doc(eventId);

    const init = await db().runTransaction(async (tx) => {
      const snap = await tx.get(eventRef);
      const existing = snap.exists ? (snap.data() as any) : null;
      const status: string | null = existing?.status ?? null;

      if (status === 'processed' || status === 'ignored') {
        return { action: 'dedupe' as const, status };
      }

      const lockExpiresAt: string | null = existing?.lockExpiresAt ?? null;
      if (lockExpiresAt && lockExpiresAt > now) {
        return { action: 'locked' as const, status: status ?? 'received' };
      }

      const nextAttempt = Number(existing?.attemptCount ?? 0) + 1;
      const nextLock = new Date(new Date(now).getTime() + STRIPE_EVENT_LOCK_TTL_MS).toISOString();

      tx.set(
        eventRef,
        {
          eventId,
          type: event.type,
          status: 'received',
          attemptCount: nextAttempt,
          lastAttemptAt: now,
          lockExpiresAt: nextLock,
          createdAt: existing?.createdAt ?? now
        },
        { merge: true }
      );

      return { action: 'process' as const };
    });

    if (init.action === 'dedupe') {
      res.status(200).json({ received: true, deduped: true, status: init.status });
      return;
    }

    if (init.action === 'locked') {
      // Do not return 2xx while another handler is still processing this event.
      // A 2xx here could cause Stripe to stop retrying even if the in-flight attempt fails.
      res.status(409).json({ received: true, processing: true });
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        const contractId = session.metadata?.contractId;
        if (!contractId) {
          await eventRef.set({ status: 'ignored', ignoredReason: 'missing_contractId', processedAt: now, lockExpiresAt: null }, { merge: true });
          res.status(200).json({ received: true, ignored: 'missing_contractId' });
          return;
        }

        if (session.payment_status !== 'paid') {
          await eventRef.set({ status: 'ignored', ignoredReason: 'not_paid', processedAt: now, lockExpiresAt: null }, { merge: true });
          res.status(200).json({ received: true, ignored: 'not_paid' });
          return;
        }

        const activation = await activateContractFromPaidCheckoutSession({ contractId, session, activatedAt: now });
        const status = activation === 'ignored_refunded' ? 'ignored' : 'processed';
        await eventRef.set(
          {
            status,
            processedAt: now,
            lockExpiresAt: null,
            result: activation
          },
          { merge: true }
        );
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

              // Best-effort notifications; expiry cleanup should not fail webhook delivery.
              try {
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
              } catch (e) {
                console.error('stripeWebhook: failed to create expiry notifications', { contractId }, e);
              }
            }
          }
        }

        await eventRef.set({ status: 'processed', processedAt: now, lockExpiresAt: null }, { merge: true });
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

        await eventRef.set({ status: 'processed', processedAt: now, lockExpiresAt: null }, { merge: true });
      }

      // For event types we don't handle, record and return 200 so Stripe doesn't retry forever.
      if (!['checkout.session.completed', 'checkout.session.expired', 'charge.refunded'].includes(event.type)) {
        await eventRef.set({ status: 'ignored', ignoredReason: 'unhandled_event_type', processedAt: now, lockExpiresAt: null }, { merge: true });
      }
    } catch (e: any) {
      const msg = e?.message ?? 'unknown';
      await eventRef.set(
        {
          status: 'error',
          errorMessage: msg,
          errorAt: nowIso(),
          lockExpiresAt: null
        },
        { merge: true }
      );
      // Non-2xx so Stripe retries.
      res.status(500).json({ received: true, error: msg });
      return;
    }

    res.status(200).json({ received: true });
  }
);
