import { onCall } from 'firebase-functions/v2/https';
import { APP_BASE_URL, STRIPE_CONNECT_REFRESH_PATH, STRIPE_CONNECT_RETURN_PATH, STRIPE_SECRET_KEY } from '../config';
import { db } from '../init';
import { requireEmailVerified, requireRole } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { emptyObjectSchema } from '../schemas/requests';
import { stripeClient } from '../utils/stripe';

type Res = { ok: true; url?: string; status?: 'not_started' | 'pending' | 'complete' };

async function getOrCreateStripeAccount(params: { uid: string; email: string | null }): Promise<string> {
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  const creatorPrivRef = db().collection('creatorPrivate').doc(params.uid);
  const creatorPubRef = db().collection('creatorProfiles').doc(params.uid);

  const now = nowIso();

  const result = await db().runTransaction(async (tx) => {
    const [privSnap, pubSnap] = await Promise.all([tx.get(creatorPrivRef), tx.get(creatorPubRef)]);
    if (!privSnap.exists || !pubSnap.exists) err('FAILED_PRECONDITION', 'PROFILE_MISSING');

    const pub = pubSnap.data() as any;
    const priv = privSnap.data() as any;

    if (pub.verificationStatus !== 'verified') err('FAILED_PRECONDITION', 'CREATOR_NOT_VERIFIED');

    const existingAccountId = priv?.stripeConnect?.accountId ?? null;
    if (existingAccountId) {
      return { accountId: existingAccountId as string, created: false };
    }

    // Create new Express account
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: params.email ?? undefined,
      capabilities: {
        transfers: { requested: true }
      },
      business_type: 'individual'
    });

    tx.update(creatorPrivRef, {
      stripeConnect: { accountId: acct.id, onboardingStatus: 'pending' },
      updatedAt: now
    });

    return { accountId: acct.id, created: true };
  });

  return result.accountId;
}

export const creatorStartStripeOnboarding = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY] },
  async (req): Promise<Res> => {
    requireEmailVerified(req);
    const { uid } = requireRole(req, ['creator']);
    await requireUserActive(uid);
    validateOrThrow(emptyObjectSchema, req.data);

    const userSnap = await db().collection('users').doc(uid).get();
    const email = userSnap.exists ? ((userSnap.data() as any).email as string) : null;

    const base = APP_BASE_URL.value();
    if (!base) err('FAILED_PRECONDITION', 'APP_BASE_URL_NOT_SET');

    const stripe = stripeClient(STRIPE_SECRET_KEY.value());
    const accountId = await getOrCreateStripeAccount({ uid, email });

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}${STRIPE_CONNECT_REFRESH_PATH}`,
      return_url: `${base}${STRIPE_CONNECT_RETURN_PATH}`,
      type: 'account_onboarding'
    });

    return { ok: true, url: link.url };
  }
);

export const creatorRefreshStripeOnboarding = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY] },
  async (req): Promise<Res> => {
    requireEmailVerified(req);
    const { uid } = requireRole(req, ['creator']);
    await requireUserActive(uid);
    validateOrThrow(emptyObjectSchema, req.data);

    const userSnap = await db().collection('users').doc(uid).get();
    const email = userSnap.exists ? ((userSnap.data() as any).email as string) : null;

    const base = APP_BASE_URL.value();
    if (!base) err('FAILED_PRECONDITION', 'APP_BASE_URL_NOT_SET');

    const stripe = stripeClient(STRIPE_SECRET_KEY.value());
    const accountId = await getOrCreateStripeAccount({ uid, email });

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}${STRIPE_CONNECT_REFRESH_PATH}`,
      return_url: `${base}${STRIPE_CONNECT_RETURN_PATH}`,
      type: 'account_onboarding'
    });

    return { ok: true, url: link.url };
  }
);

export const creatorSyncStripeOnboardingStatus = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY] },
  async (req): Promise<Res> => {
    requireEmailVerified(req);
    const { uid } = requireRole(req, ['creator']);
    await requireUserActive(uid);
    validateOrThrow(emptyObjectSchema, req.data);

    const creatorPrivRef = db().collection('creatorPrivate').doc(uid);
    const privSnap = await creatorPrivRef.get();
    if (!privSnap.exists) err('FAILED_PRECONDITION', 'PROFILE_MISSING');

    const priv = privSnap.data() as any;
    const accountId = priv?.stripeConnect?.accountId ?? null;
    if (!accountId) return { ok: true, status: 'not_started' };

    const stripe = stripeClient(STRIPE_SECRET_KEY.value());
    const acct = await stripe.accounts.retrieve(accountId);

    const complete = !!(acct.details_submitted && (acct.payouts_enabled || (acct as any).charges_enabled));
    const status: 'pending' | 'complete' = complete ? 'complete' : 'pending';
    const now = nowIso();

    await creatorPrivRef.update({ stripeConnect: { accountId, onboardingStatus: status }, updatedAt: now });

    return { ok: true, status };
  }
);
