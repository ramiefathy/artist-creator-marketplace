import { db } from '../init';
import { err } from './errors';

export type RateLimitWindow = 'minute' | 'day';

export type RateLimitSpec = {
  window: RateLimitWindow;
  max: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

export function getRateLimitBucketId(params: { now: Date; window: RateLimitWindow }): string {
  const d = params.now;
  if (params.window === 'day') return `day:${ymdUtc(d)}`;
  // minute
  return `min:${ymdUtc(d)}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}`;
}

export function getRateLimitResetAtIso(params: { now: Date; window: RateLimitWindow }): string {
  const d = new Date(params.now.getTime());
  if (params.window === 'day') {
    d.setUTCHours(24, 0, 0, 0);
    return d.toISOString();
  }
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  return d.toISOString();
}

export function getRetryAfterSeconds(params: { now: Date; window: RateLimitWindow }): number {
  const resetMs = Date.parse(getRateLimitResetAtIso(params));
  const nowMs = params.now.getTime();
  const remaining = Math.ceil((resetMs - nowMs) / 1000);
  return Math.max(0, remaining);
}

export async function enforceRateLimit(params: {
  uid: string;
  action: string;
  nowIso: string;
  limits: RateLimitSpec[];
}): Promise<void> {
  const now = new Date(params.nowIso);
  if (!Number.isFinite(now.getTime())) err('INTERNAL', 'INVALID_NOW');

  const limits = params.limits.filter((l) => Number.isFinite(l.max) && l.max > 0);
  if (limits.length === 0) return;

  const col = db().collection('rateLimits');
  const refs = limits.map((l) => col.doc(`${params.action}:${params.uid}:${getRateLimitBucketId({ now, window: l.window })}`));

  await db().runTransaction(async (tx) => {
    const snaps = await tx.getAll(...refs);

    for (let i = 0; i < limits.length; i++) {
      const spec = limits[i];
      const snap = snaps[i];
      const current = snap.exists ? Number((snap.data() as any).count ?? 0) : 0;
      if (current >= spec.max) {
        err('RESOURCE_EXHAUSTED', 'RATE_LIMITED', {
          action: params.action,
          window: spec.window,
          limit: spec.max,
          retryAfterSeconds: getRetryAfterSeconds({ now, window: spec.window })
        });
      }
    }

    for (let i = 0; i < limits.length; i++) {
      const spec = limits[i];
      const ref = refs[i];
      const snap = snaps[i];
      const current = snap.exists ? Number((snap.data() as any).count ?? 0) : 0;

      tx.set(
        ref,
        {
          uid: params.uid,
          action: params.action,
          window: spec.window,
          bucket: getRateLimitBucketId({ now, window: spec.window }),
          count: current + 1,
          resetAt: getRateLimitResetAtIso({ now, window: spec.window }),
          updatedAt: params.nowIso,
          createdAt: snap.exists ? ((snap.data() as any).createdAt ?? params.nowIso) : params.nowIso
        },
        { merge: true }
      );
    }
  });
}

