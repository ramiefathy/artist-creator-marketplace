import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '../shared/constants';
import { STRIPE_SECRET_KEY } from '../config';

export function stripeClient(secret: string): Stripe {
  return new Stripe(secret, { apiVersion: STRIPE_API_VERSION as any });
}

export function getStripe(): Stripe {
  const secret = STRIPE_SECRET_KEY.value();
  return stripeClient(secret);
}

export function assertStripeWebhookSignature(params: {
  stripe: Stripe;
  payload: Buffer;
  sigHeader: string | undefined;
  webhookSecret: string;
}): Stripe.Event {
  const { stripe, payload, sigHeader, webhookSecret } = params;
  if (!sigHeader) throw new Error('Missing Stripe-Signature header');
  return stripe.webhooks.constructEvent(payload, sigHeader, webhookSecret);
}
