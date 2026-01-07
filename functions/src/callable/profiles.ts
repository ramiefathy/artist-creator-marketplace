import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireEmailVerified, requireRole } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { updateArtistProfileSchema, updateCreatorProfileSchema } from '../schemas/requests';

type UpdateArtistReq = {
  displayName: string;
  entityType: 'individual' | 'label' | 'management';
  country: string;
  timezone: string;
};

type UpdateCreatorReq = {
  displayName: string;
  bio: string | null;
  niches: string[];
  platformHandles: { tiktok: string | null; instagram: string | null; youtube: string | null };
  audienceCountries: string[];
  metricsSelfReported: {
    tiktokFollowers: number;
    tiktokAvgViews: number;
    instagramFollowers: number;
    instagramAvgViews: number;
    youtubeSubscribers: number;
    youtubeAvgViews: number;
  };
};

export const updateArtistProfile = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['artist', 'admin']);
  await requireUserActive(uid);

  const data = validateOrThrow<UpdateArtistReq>(updateArtistProfileSchema, req.data);
  const now = nowIso();

  const ref = db().collection('artistProfiles').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) err('FAILED_PRECONDITION', 'PROFILE_MISSING');

  await ref.update({
    displayName: data.displayName,
    entityType: data.entityType,
    country: data.country,
    timezone: data.timezone,
    updatedAt: now
  });

  return { ok: true };
});

export const updateCreatorProfile = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid } = requireRole(req, ['creator', 'admin']);
  await requireUserActive(uid);

  const data = validateOrThrow<UpdateCreatorReq>(updateCreatorProfileSchema, req.data);
  const now = nowIso();

  const ref = db().collection('creatorProfiles').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) err('FAILED_PRECONDITION', 'PROFILE_MISSING');

  await ref.update({
    displayName: data.displayName,
    bio: data.bio,
    niches: data.niches,
    platformHandles: data.platformHandles,
    audienceCountries: data.audienceCountries,
    metricsSelfReported: data.metricsSelfReported,
    updatedAt: now
  });

  return { ok: true };
});
