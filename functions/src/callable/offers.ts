import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { bucket, db } from '../init';
import { requireEmailVerified, requireRole } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { submitOfferSchema, byIdSchema } from '../schemas/requests';
import { stripeClient } from '../utils/stripe';
import { STRIPE_SECRET_KEY, APP_BASE_URL } from '../config';
import { PLATFORM_FEE_BPS, LICENSE_GRANT_TEXT_V1, DISCLOSURE_REQUIREMENTS_TEXT_V1 } from '../shared/constants';
import { createNotification } from '../utils/notifications';
import { renderContractPdf } from '../utils/pdf';

type SubmitReq = { campaignId: string; priceCents: number; message: string | null };
type ByIdReq = { offerId: string };

function threadIdFor(campaignId: string, creatorUid: string): string {
  return `c_${campaignId}_u_${creatorUid}`;
}

async function ensureArtistStripeCustomerId(artistUid: string): Promise<string> {
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  const privRef = db().collection('artistPrivate').doc(artistUid);
  const privSnap = await privRef.get();
  if (!privSnap.exists) {
    // Create the doc if missing
    await privRef.set({
      uid: artistUid,
      stripeCustomerId: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }
  const current = (await privRef.get()).data() as any;
  if (current.stripeCustomerId) return current.stripeCustomerId as string;

  const userSnap = await db().collection('users').doc(artistUid).get();
  const email = userSnap.exists ? ((userSnap.data() as any).email as string) : undefined;

  const cust = await stripe.customers.create({ email });
  await privRef.update({ stripeCustomerId: cust.id, updatedAt: nowIso() });
  return cust.id;
}

async function uploadContractPdf(contractId: string, pdf: Buffer): Promise<string> {
  const path = `contracts/${contractId}/contract.pdf`;
  const file = bucket().file(path);
  await file.save(pdf, { contentType: 'application/pdf', resumable: false, metadata: { cacheControl: 'private, max-age=0' } });
  return path;
}

export const submitOffer = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid: creatorUid } = requireRole(req, ['creator']);
  await requireUserActive(creatorUid);

  const data = validateOrThrow<SubmitReq>(submitOfferSchema, req.data);
  const now = nowIso();

  // Verify creator eligibility
  const [creatorPubSnap, creatorPrivSnap] = await Promise.all([
    db().collection('creatorProfiles').doc(creatorUid).get(),
    db().collection('creatorPrivate').doc(creatorUid).get()
  ]);
  if (!creatorPubSnap.exists || !creatorPrivSnap.exists) err('FAILED_PRECONDITION', 'PROFILE_MISSING');

  const creatorPub = creatorPubSnap.data() as any;
  const creatorPriv = creatorPrivSnap.data() as any;
  if (creatorPub.verificationStatus !== 'verified') err('FAILED_PRECONDITION', 'CREATOR_NOT_VERIFIED');
  if (creatorPriv.stripeConnect?.onboardingStatus !== 'complete') err('FAILED_PRECONDITION', 'STRIPE_ONBOARDING_INCOMPLETE');

  // Verify campaign is live
  const campaignRef = db().collection('campaigns').doc(data.campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) err('NOT_FOUND', 'CAMPAIGN_NOT_FOUND');
  const campaign = campaignSnap.data() as any;
  if (campaign.status !== 'live') err('FAILED_PRECONDITION', 'CAMPAIGN_NOT_LIVE');

  // Price guard
  if (data.priceCents > campaign.pricing.maxPricePerDeliverableCents) err('FAILED_PRECONDITION', 'PRICE_EXCEEDS_MAX');

  // Prevent duplicate submitted offers by same creator for same campaign
  const existing = await db()
    .collection('offers')
    .where('campaignId', '==', data.campaignId)
    .where('creatorUid', '==', creatorUid)
    .where('status', '==', 'submitted')
    .limit(1)
    .get();
  if (!existing.empty) err('ALREADY_EXISTS', 'OFFER_ALREADY_SUBMITTED');

  const offerRef = db().collection('offers').doc();
  const offerId = offerRef.id;

  await offerRef.set({
    offerId,
    campaignId: data.campaignId,
    creatorUid,
    artistUid: campaign.ownerUid,
    deliverablesCount: 1,
    priceCents: data.priceCents,
    message: data.message ?? null,
    status: 'submitted',
    createdAt: now,
    updatedAt: now
  });

  // Ensure messaging thread exists
  const threadRef = db().collection('threads').doc(threadIdFor(data.campaignId, creatorUid));
  await threadRef.set(
    {
      threadId: threadRef.id,
      participants: [campaign.ownerUid, creatorUid],
      campaignId: data.campaignId,
      offerId,
      contractId: null,
      lastMessageAt: now,
      lastMessagePreview: 'Offer submitted',
      updatedAt: now,
      createdAt: now
    },
    { merge: true }
  );

  await createNotification({
    toUid: campaign.ownerUid,
    type: 'offer_submitted',
    title: 'New offer submitted',
    body: `A creator submitted an offer for your campaign: ${campaign.title}`,
    link: `/artist/campaigns/${data.campaignId}`
  });

  return { ok: true, offerId };
});

export const withdrawOffer = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid: creatorUid } = requireRole(req, ['creator']);
  await requireUserActive(creatorUid);

  const data = validateOrThrow<ByIdReq>(byIdSchema('offerId'), req.data);
  const now = nowIso();

  const offerRef = db().collection('offers').doc(data.offerId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(offerRef);
    if (!snap.exists) err('NOT_FOUND', 'OFFER_NOT_FOUND');
    const offer = snap.data() as any;
    if (offer.creatorUid !== creatorUid) err('PERMISSION_DENIED', 'NOT_OWNER');
    if (offer.status !== 'submitted') err('FAILED_PRECONDITION', 'NOT_WITHDRAWABLE');

    tx.update(offerRef, { status: 'withdrawn', updatedAt: now });
  });

  return { ok: true };
});

export const rejectOffer = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid: artistUid } = requireRole(req, ['artist']);
  await requireUserActive(artistUid);

  const data = validateOrThrow<ByIdReq>(byIdSchema('offerId'), req.data);
  const now = nowIso();
  const offerRef = db().collection('offers').doc(data.offerId);

  let creatorUid: string | null = null;
  let campaignId: string | null = null;

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(offerRef);
    if (!snap.exists) err('NOT_FOUND', 'OFFER_NOT_FOUND');
    const offer = snap.data() as any;
    if (offer.artistUid !== artistUid) err('PERMISSION_DENIED', 'NOT_OWNER');
    if (offer.status !== 'submitted') err('FAILED_PRECONDITION', 'NOT_REJECTABLE');

    creatorUid = offer.creatorUid;
    campaignId = offer.campaignId;

    tx.update(offerRef, { status: 'rejected', updatedAt: now });
  });

  if (creatorUid && campaignId) {
    await createNotification({
      toUid: creatorUid,
      type: 'offer_rejected',
      title: 'Offer rejected',
      body: 'Your offer was rejected by the artist.',
      link: `/creator/offers`
    });
  }

  return { ok: true };
});

export const acceptOffer = onCall(
  { region: 'us-central1', secrets: [STRIPE_SECRET_KEY] },
  async (req) => {
    requireEmailVerified(req);
    const { uid: artistUid } = requireRole(req, ['artist']);
    await requireUserActive(artistUid);

    const data = validateOrThrow<{ offerId: string }>(byIdSchema('offerId'), req.data);
    const now = nowIso();

    const offerRef = db().collection('offers').doc(data.offerId);
    const contractId = data.offerId; // deterministic 1:1 mapping
    const contractRef = db().collection('contracts').doc(contractId);
    const deliverableRef = db().collection('deliverables').doc(contractId);

    // Phase 1: reserve contract (transactional)
    let creatorUid: string = '';
    let campaignId: string = '';
    let trackId: string = '';
    let priceCents: number = 0;
    let dueDaysAfterActivation: number = 7;
    let deliverableType: string = 'tiktok_post';
    let creatorStripeAccountId: string = '';

    await db().runTransaction(async (tx) => {
      const [offerSnap, existingContractSnap] = await Promise.all([tx.get(offerRef), tx.get(contractRef)]);
      if (!offerSnap.exists) err('NOT_FOUND', 'OFFER_NOT_FOUND');
      const offer = offerSnap.data() as any;

      if (offer.artistUid !== artistUid) err('PERMISSION_DENIED', 'NOT_OWNER');
      if (offer.status !== 'submitted' && offer.status !== 'accepted') err('FAILED_PRECONDITION', 'NOT_ACCEPTABLE');

      creatorUid = offer.creatorUid;
      campaignId = offer.campaignId;
      priceCents = offer.priceCents;

      // If contract already exists, do not re-create; allow idempotent return.
      if (existingContractSnap.exists) {
        return;
      }

      const campaignRef = db().collection('campaigns').doc(campaignId);
      const [campaignSnap, creatorPubSnap, creatorPrivSnap] = await Promise.all([
        tx.get(campaignRef),
        tx.get(db().collection('creatorProfiles').doc(creatorUid)),
        tx.get(db().collection('creatorPrivate').doc(creatorUid))
      ]);

      if (!campaignSnap.exists) err('NOT_FOUND', 'CAMPAIGN_NOT_FOUND');
      const campaign = campaignSnap.data() as any;
      if (campaign.ownerUid !== artistUid) err('PERMISSION_DENIED', 'NOT_OWNER');
      if (campaign.status !== 'live') err('FAILED_PRECONDITION', 'CAMPAIGN_NOT_LIVE');

      const total = campaign.deliverableSpec?.deliverablesTotal ?? 0;
      const accepted = campaign.acceptedDeliverablesCount ?? 0;
      if (accepted >= total) err('FAILED_PRECONDITION', 'CAMPAIGN_FULL');

      if (priceCents > campaign.pricing.maxPricePerDeliverableCents) err('FAILED_PRECONDITION', 'PRICE_EXCEEDS_MAX');

      if (!creatorPubSnap.exists || !creatorPrivSnap.exists) err('FAILED_PRECONDITION', 'CREATOR_PROFILE_MISSING');
      const creatorPub = creatorPubSnap.data() as any;
      const creatorPriv = creatorPrivSnap.data() as any;
      if (creatorPub.verificationStatus !== 'verified') err('FAILED_PRECONDITION', 'CREATOR_NOT_VERIFIED');
      if (creatorPriv.stripeConnect?.onboardingStatus !== 'complete') err('FAILED_PRECONDITION', 'CREATOR_STRIPE_NOT_READY');
      if (!creatorPriv.stripeConnect?.accountId) err('FAILED_PRECONDITION', 'CREATOR_STRIPE_ACCOUNT_MISSING');
      creatorStripeAccountId = creatorPriv.stripeConnect.accountId;

      trackId = campaign.trackId;
      dueDaysAfterActivation = campaign.deliverableSpec?.dueDaysAfterActivation ?? 7;
      deliverableType = campaign.deliverableSpec?.deliverableType ?? 'tiktok_post';

      // Create contract + deliverable
      const platformFee = Math.floor((priceCents * PLATFORM_FEE_BPS) / 10000);
      const creatorPayout = priceCents - platformFee;

      tx.set(contractRef, {
        contractId,
        campaignId,
        trackId,
        artistUid,
        creatorUid,
        offerId: data.offerId,
        status: 'pending_payment',
        pricing: {
          currency: 'USD',
          totalPriceCents: priceCents,
          platformFeeBps: PLATFORM_FEE_BPS,
          creatorPayoutTotalCents: creatorPayout
        },
        payout: {
          creatorStripeAccountId,
          paidOutCents: 0,
          stripeTransferId: null,
          transferStatus: 'none'
        },
        stripe: {
          checkoutSessionId: '',
          paymentIntentId: null,
          paymentStatus: 'unpaid'
        },
        terms: {
          termsVersion: 'v1',
          licenseGrantText: LICENSE_GRANT_TEXT_V1,
          disclosureRequirementsText: DISCLOSURE_REQUIREMENTS_TEXT_V1,
          agreedByCreatorAt: offer.createdAt ?? now,
          agreedByArtistAt: now
        },
        snapshots: {
          campaign: campaign
        },
        contractPdfPath: `contracts/${contractId}/contract.pdf`,
        activatedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now
      });

      const dueAt = new Date(Date.now() + dueDaysAfterActivation * 24 * 60 * 60 * 1000).toISOString();

      tx.set(deliverableRef, {
        deliverableId: contractId,
        contractId,
        campaignId,
        artistUid,
        creatorUid,
        type: deliverableType,
        dueAt,
        status: 'pending',
        submission: {
          postUrl: null,
          submittedAt: null,
          creatorNotes: null,
          compliance: null,
          evidencePaths: [],
          metrics24h: null
        },
        review: {
          artistDecision: 'none',
          artistNotes: null,
          reviewedAt: null
        },
        createdAt: now,
        updatedAt: now
      });

      // Update offer status
      tx.update(offerRef, { status: 'accepted', updatedAt: now });

      // Reserve slot and auto-pause the campaign when it reaches capacity.
      // (Slots are reserved at offer-accept time, not at payment time.)
      const nextAccepted = accepted + 1;
      const campaignUpdate: Record<string, any> = {
        acceptedDeliverablesCount: nextAccepted,
        updatedAt: now
      };

      // If the campaign becomes full, pause it to prevent new offers.
      // It will be re-opened automatically if a reserved contract is cancelled.
      if (nextAccepted >= total && campaign.status === 'live') {
        campaignUpdate.status = 'paused';
        campaignUpdate.autoPaused = true;
      }

      tx.update(campaignRef, campaignUpdate);

      // Ensure thread links to contract
      const threadRef = db().collection('threads').doc(threadIdFor(campaignId, creatorUid));
      tx.set(
        threadRef,
        {
          threadId: threadRef.id,
          participants: [artistUid, creatorUid],
          campaignId,
          offerId: data.offerId,
          contractId,
          lastMessageAt: now,
          createdAt: now
        },
        { merge: true }
      );
    });

    // Phase 2: ensure checkout session exists and contract PDF uploaded
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) err('INTERNAL', 'CONTRACT_MISSING');
    const contract = contractSnap.data() as any;

    const baseUrl = APP_BASE_URL.value();
    if (!baseUrl) err('FAILED_PRECONDITION', 'APP_BASE_URL_NOT_SET');

    const stripe = stripeClient(STRIPE_SECRET_KEY.value());

    // Ensure customer
    const customerId = await ensureArtistStripeCustomerId(artistUid);

    let checkoutSessionId: string = contract.stripe?.checkoutSessionId ?? '';
    let checkoutUrl: string | null = null;

    if (!checkoutSessionId) {
      // Create new checkout session (idempotent)
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer: customerId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: contract.pricing.totalPriceCents,
                product_data: {
                  name: `Campaign deliverable: ${contract.campaignId}`
                }
              }
            }
          ],
          success_url: `${baseUrl}/artist/contracts/${contractId}?success=1`,
          cancel_url: `${baseUrl}/artist/contracts/${contractId}?canceled=1`,
          metadata: {
            contractId,
            offerId: contract.offerId,
            campaignId: contract.campaignId,
            trackId: contract.trackId,
            artistUid: contract.artistUid,
            creatorUid: contract.creatorUid
          },
          payment_intent_data: {
            metadata: { contractId }
          }
        },
        { idempotencyKey: `checkout_${contractId}` }
      );

      checkoutSessionId = session.id;
      checkoutUrl = session.url ?? null;

      await contractRef.update({
        stripe: { ...contract.stripe, checkoutSessionId },
        updatedAt: nowIso()
      });
    } else {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      checkoutUrl = (session as any).url ?? null;
    }

    // Upload PDF if missing
    const pdfPath = contract.contractPdfPath as string;
    const file = bucket().file(pdfPath);
    const [exists] = await file.exists();

    if (!exists) {
      // Render a basic PDF summary
      const creatorProfileSnap = await db().collection('creatorProfiles').doc(contract.creatorUid).get();
      const creatorName = creatorProfileSnap.exists ? ((creatorProfileSnap.data() as any).displayName as string) : contract.creatorUid;

      const artistProfileSnap = await db().collection('artistProfiles').doc(contract.artistUid).get();
      const artistName = artistProfileSnap.exists ? ((artistProfileSnap.data() as any).displayName as string) : contract.artistUid;

      const contractText = [
        `Total price: $${(contract.pricing.totalPriceCents / 100).toFixed(2)} USD`,
        `Platform fee (bps): ${contract.pricing.platformFeeBps}`,
        `Creator payout: $${(contract.pricing.creatorPayoutTotalCents / 100).toFixed(2)} USD`,
        '',
        'License:',
        contract.terms.licenseGrantText,
        '',
        'Disclosure requirements:',
        contract.terms.disclosureRequirementsText
      ].join('\n');

      const pdf = await renderContractPdf({
        title: 'Music Promotion Contract (v1)',
        artistName,
        creatorName,
        contractId,
        contractText
      });
      await uploadContractPdf(contractId, pdf);
    }

    // Notify creator that offer is accepted (payment pending)
    await createNotification({
      toUid: contract.creatorUid,
      type: 'offer_accepted',
      title: 'Offer accepted',
      body: 'Your offer was accepted. Await payment confirmation before posting.',
      link: `/creator/contracts/${contractId}`
    });

    return { ok: true, contractId, checkoutUrl };
  }
);
