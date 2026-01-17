import { onCall } from 'firebase-functions/v2/https';
import { randomUUID } from 'crypto';
import { db } from '../init';
import { requireAuth, requireEmailVerified, requireRole } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { ensurePublicIdentity } from '../utils/publicIdentity';
import {
  createCampaignSchema,
  publishCampaignSchema,
  setCampaignPublicVisibilitySchema,
  updateCampaignSchema,
  updateCampaignStatusSchema
} from '../schemas/requests';
import { POST_MUST_REMAIN_LIVE_DAYS } from '../shared/constants';

type CreateReq = any;
type PublishReq = { campaignId: string };
type SetPublicReq = { campaignId: string; isPubliclyVisible: boolean };
type UpdateReq = { campaignId: string; patch: Record<string, any> };
type UpdateStatusReq = { campaignId: string; status: 'draft' | 'live' | 'paused' | 'completed' | 'archived' };

function pickPatch(patch: Record<string, any>) {
  const out: Record<string, any> = {};

  if (typeof patch.title === 'string') out.title = patch.title;
  if (typeof patch.brief === 'string') out.brief = patch.brief;
  if (typeof patch.isPubliclyVisible === 'boolean') out.isPubliclyVisible = patch.isPubliclyVisible;
  if (Array.isArray(patch.platforms)) out.platforms = patch.platforms;

  if (patch.deliverableSpec && typeof patch.deliverableSpec === 'object') {
    out.deliverableSpec = {};
    if (typeof patch.deliverableSpec.deliverablesTotal === 'number') out.deliverableSpec.deliverablesTotal = patch.deliverableSpec.deliverablesTotal;
    if (typeof patch.deliverableSpec.deliverableType === 'string') out.deliverableSpec.deliverableType = patch.deliverableSpec.deliverableType;
    if (typeof patch.deliverableSpec.dueDaysAfterActivation === 'number') out.deliverableSpec.dueDaysAfterActivation = patch.deliverableSpec.dueDaysAfterActivation;
    // postMustRemainLiveDays is fixed at 30
  }

  if (patch.contentGuidelines && typeof patch.contentGuidelines === 'object') {
    out.contentGuidelines = {};
    if (typeof patch.contentGuidelines.disclosureTextExample === 'string') out.contentGuidelines.disclosureTextExample = patch.contentGuidelines.disclosureTextExample;
    if (Array.isArray(patch.contentGuidelines.hashtags)) out.contentGuidelines.hashtags = patch.contentGuidelines.hashtags;
    if ('callToAction' in patch.contentGuidelines) out.contentGuidelines.callToAction = patch.contentGuidelines.callToAction;
    if ('doNotInclude' in patch.contentGuidelines) out.contentGuidelines.doNotInclude = patch.contentGuidelines.doNotInclude;
  }

  if (patch.pricing && typeof patch.pricing === 'object') {
    out.pricing = {};
    if (typeof patch.pricing.maxPricePerDeliverableCents === 'number') out.pricing.maxPricePerDeliverableCents = patch.pricing.maxPricePerDeliverableCents;
  }

  return out;
}

function shouldHavePublicCampaignProjection(campaign: any): boolean {
  if (!campaign) return false;
  if (!campaign.isPubliclyVisible) return false;
  const status = String(campaign.status ?? '');
  return status !== 'draft' && status !== 'archived';
}

function buildPublicCampaignDoc(params: { campaign: any; track: any; artistPublic: any; now: string }): Record<string, any> {
  const c = params.campaign;
  const t = params.track;
  const p = params.artistPublic;

  return {
    campaignId: String(c.campaignId ?? ''),
    status: String(c.status ?? ''),
    title: String(c.title ?? ''),
    brief: String(c.brief ?? ''),
    platforms: Array.isArray(c.platforms) ? c.platforms : [],
    deliverableSpec: {
      deliverablesTotal: Number(c.deliverableSpec?.deliverablesTotal ?? 0),
      deliverableType: String(c.deliverableSpec?.deliverableType ?? ''),
      postMustRemainLiveDays: Number(c.deliverableSpec?.postMustRemainLiveDays ?? POST_MUST_REMAIN_LIVE_DAYS),
      dueDaysAfterActivation: Number(c.deliverableSpec?.dueDaysAfterActivation ?? 0)
    },
    pricing: {
      currency: 'USD',
      maxPricePerDeliverableCents: Number(c.pricing?.maxPricePerDeliverableCents ?? 0)
    },
    artist: {
      uid: String(c.ownerUid ?? ''),
      handle: String(p?.handle ?? ''),
      displayName: String(p?.displayName ?? 'Artist'),
      roleLabel: String(p?.roleLabel ?? 'artist')
    },
    track: {
      trackId: String(c.trackId ?? ''),
      title: String(t?.title ?? ''),
      artistName: String(t?.artistName ?? ''),
      genre: String(t?.genre ?? '')
    },
    createdAt: String(c.createdAt ?? ''),
    updatedAt: params.now
  };
}

export const createCampaign = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  const { email } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<CreateReq>(createCampaignSchema, req.data);

  // Ensure the artist has a public identity so public campaign pages can attribute ownership.
  await ensurePublicIdentity({ uid, displayNameOrEmail: email ?? null, preferGuest: false, roleLabel: 'artist' });

  const trackSnap = await db().collection('tracks').doc(data.trackId).get();
  if (!trackSnap.exists) err('NOT_FOUND', 'TRACK_NOT_FOUND');
  const track = trackSnap.data() as any;
  if (track.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');
  if (track.status !== 'active') err('FAILED_PRECONDITION', 'TRACK_NOT_ACTIVE');
  if (track.rightsReview?.status === 'rejected') err('FAILED_PRECONDITION', 'TRACK_RIGHTS_REJECTED');

  const campaignId = randomUUID();
  const now = nowIso();

  const doc = {
    campaignId,
    ownerUid: uid,
    trackId: data.trackId,
    title: data.title,
    brief: data.brief,
    isPubliclyVisible: !!data.isPubliclyVisible,
    platforms: data.platforms,
    deliverableSpec: {
      deliverablesTotal: data.deliverableSpec.deliverablesTotal,
      deliverableType: data.deliverableSpec.deliverableType,
      postMustRemainLiveDays: POST_MUST_REMAIN_LIVE_DAYS,
      dueDaysAfterActivation: data.deliverableSpec.dueDaysAfterActivation
    },
    contentGuidelines: {
      mustIncludeDisclosure: true,
      disclosureTextExample: data.contentGuidelines.disclosureTextExample,
      hashtags: data.contentGuidelines.hashtags,
      callToAction: data.contentGuidelines.callToAction ?? null,
      doNotInclude: data.contentGuidelines.doNotInclude ?? null
    },
    pricing: {
      currency: 'USD',
      maxPricePerDeliverableCents: data.pricing.maxPricePerDeliverableCents
    },
    status: 'draft',
    acceptedDeliverablesCount: 0,
    autoPaused: false,
    createdAt: now,
    updatedAt: now
  };

  await db().collection('campaigns').doc(campaignId).set(doc);

  return { ok: true, campaignId };
});

export const publishCampaign = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  const { email } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<PublishReq>(publishCampaignSchema, req.data);
  const now = nowIso();

  await ensurePublicIdentity({ uid, displayNameOrEmail: email ?? null, preferGuest: false, roleLabel: 'artist' });

  const ref = db().collection('campaigns').doc(data.campaignId);
  const publicRef = db().collection('publicCampaigns').doc(data.campaignId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err('NOT_FOUND', 'CAMPAIGN_NOT_FOUND');
    const c = snap.data() as any;
    if (c.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');
    if (c.status !== 'draft') err('FAILED_PRECONDITION', 'NOT_DRAFT');

    const next = { ...c, status: 'live' };
    tx.update(ref, { status: 'live', autoPaused: false, updatedAt: now });

    if (shouldHavePublicCampaignProjection(next)) {
      const trackRef = db().collection('tracks').doc(String(c.trackId ?? ''));
      const artistPublicRef = db().collection('publicProfiles').doc(uid);
      const [trackSnap, artistPublicSnap] = await Promise.all([tx.get(trackRef), tx.get(artistPublicRef)]);
      if (!trackSnap.exists) err('NOT_FOUND', 'TRACK_NOT_FOUND');
      if (!artistPublicSnap.exists) err('NOT_FOUND', 'PROFILE_NOT_FOUND');
      tx.set(publicRef, buildPublicCampaignDoc({ campaign: next, track: trackSnap.data(), artistPublic: artistPublicSnap.data(), now }));
    } else {
      tx.delete(publicRef);
    }
  });

  return { ok: true };
});

export const updateCampaign = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  const { email } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<UpdateReq>(updateCampaignSchema, req.data);
  const ref = db().collection('campaigns').doc(data.campaignId);
  const now = nowIso();

  await ensurePublicIdentity({ uid, displayNameOrEmail: email ?? null, preferGuest: false, roleLabel: 'artist' });

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err('NOT_FOUND', 'CAMPAIGN_NOT_FOUND');
    const c = snap.data() as any;
    if (c.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');
    if (c.status !== 'draft') err('FAILED_PRECONDITION', 'ONLY_DRAFT_EDITABLE');

    const patch = pickPatch(data.patch);

    // Merge nested objects carefully
    const update: Record<string, any> = { updatedAt: now };
    if (patch.title) update.title = patch.title;
    if (patch.brief) update.brief = patch.brief;
    if (patch.platforms) update.platforms = patch.platforms;
    if (typeof patch.isPubliclyVisible === 'boolean') update.isPubliclyVisible = patch.isPubliclyVisible;

    if (patch.deliverableSpec) {
      update.deliverableSpec = {
        ...c.deliverableSpec,
        ...patch.deliverableSpec,
        postMustRemainLiveDays: POST_MUST_REMAIN_LIVE_DAYS
      };
    }
    if (patch.contentGuidelines) {
      update.contentGuidelines = {
        ...c.contentGuidelines,
        ...patch.contentGuidelines,
        mustIncludeDisclosure: true
      };
    }
    if (patch.pricing) {
      update.pricing = { ...c.pricing, ...patch.pricing, currency: 'USD' };
    }

    tx.update(ref, update);
  });

  return { ok: true };
});

export const updateCampaignStatus = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  const { email } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<UpdateStatusReq>(updateCampaignStatusSchema, req.data);
  const now = nowIso();
  const ref = db().collection('campaigns').doc(data.campaignId);
  const publicRef = db().collection('publicCampaigns').doc(data.campaignId);

  await ensurePublicIdentity({ uid, displayNameOrEmail: email ?? null, preferGuest: false, roleLabel: 'artist' });

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err('NOT_FOUND', 'CAMPAIGN_NOT_FOUND');
    const c = snap.data() as any;
    if (c.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');

    const from = c.status as string;
    const to = data.status as string;

    const allowedTransitions: Record<string, string[]> = {
      draft: ['live', 'archived'],
      live: ['paused', 'completed', 'archived'],
      paused: ['live', 'archived'],
      completed: ['archived'],
      archived: []
    };

    if (!allowedTransitions[from]?.includes(to)) err('FAILED_PRECONDITION', 'INVALID_STATUS_TRANSITION', { from, to });

    // completion gate
    if (to === 'completed') {
      const total = c.deliverableSpec?.deliverablesTotal ?? 0;
      const accepted = c.acceptedDeliverablesCount ?? 0;
      if (accepted < total) err('FAILED_PRECONDITION', 'CANNOT_COMPLETE_CAMPAIGN');
    }

    // Any manual status change should clear auto-paused state.
    const next = { ...c, status: to };
    tx.update(ref, { status: to, autoPaused: false, updatedAt: now });

    if (shouldHavePublicCampaignProjection(next)) {
      const trackRef = db().collection('tracks').doc(String(c.trackId ?? ''));
      const artistPublicRef = db().collection('publicProfiles').doc(uid);
      const [trackSnap, artistPublicSnap] = await Promise.all([tx.get(trackRef), tx.get(artistPublicRef)]);
      if (!trackSnap.exists) err('NOT_FOUND', 'TRACK_NOT_FOUND');
      if (!artistPublicSnap.exists) err('NOT_FOUND', 'PROFILE_NOT_FOUND');
      tx.set(publicRef, buildPublicCampaignDoc({ campaign: next, track: trackSnap.data(), artistPublic: artistPublicSnap.data(), now }));
    } else {
      tx.delete(publicRef);
    }
  });

  return { ok: true };
});

export const setCampaignPublicVisibility = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist']);
  const { email } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<SetPublicReq>(setCampaignPublicVisibilitySchema, req.data);
  const now = nowIso();

  await ensurePublicIdentity({ uid, displayNameOrEmail: email ?? null, preferGuest: false, roleLabel: 'artist' });

  const ref = db().collection('campaigns').doc(data.campaignId);
  const publicRef = db().collection('publicCampaigns').doc(data.campaignId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) err('NOT_FOUND', 'CAMPAIGN_NOT_FOUND');
    const c = snap.data() as any;
    if (c.ownerUid !== uid) err('PERMISSION_DENIED', 'NOT_OWNER');

    const next = { ...c, isPubliclyVisible: !!data.isPubliclyVisible };
    tx.update(ref, { isPubliclyVisible: !!data.isPubliclyVisible, updatedAt: now });

    if (shouldHavePublicCampaignProjection(next)) {
      const trackRef = db().collection('tracks').doc(String(c.trackId ?? ''));
      const artistPublicRef = db().collection('publicProfiles').doc(uid);
      const [trackSnap, artistPublicSnap] = await Promise.all([tx.get(trackRef), tx.get(artistPublicRef)]);
      if (!trackSnap.exists) err('NOT_FOUND', 'TRACK_NOT_FOUND');
      if (!artistPublicSnap.exists) err('NOT_FOUND', 'PROFILE_NOT_FOUND');
      tx.set(publicRef, buildPublicCampaignDoc({ campaign: next, track: trackSnap.data(), artistPublic: artistPublicSnap.data(), now }));
    } else {
      tx.delete(publicRef);
    }
  });

  return { ok: true };
});
