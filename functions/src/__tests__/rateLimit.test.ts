import { getRateLimitBucketId, getRateLimitResetAtIso, getRetryAfterSeconds } from '../utils/rateLimit';

describe('rateLimit', () => {
  test('minute bucket is stable within minute', () => {
    const a = new Date('2026-01-16T00:00:10.000Z');
    const b = new Date('2026-01-16T00:00:59.999Z');
    expect(getRateLimitBucketId({ now: a, window: 'minute' })).toBe(getRateLimitBucketId({ now: b, window: 'minute' }));
  });

  test('minute reset is next minute boundary', () => {
    const now = new Date('2026-01-16T00:00:10.000Z');
    expect(getRateLimitResetAtIso({ now, window: 'minute' })).toBe('2026-01-16T00:01:00.000Z');
    expect(getRetryAfterSeconds({ now, window: 'minute' })).toBe(50);
  });

  test('day bucket uses UTC date', () => {
    const now = new Date('2026-01-16T23:59:59.000Z');
    expect(getRateLimitBucketId({ now, window: 'day' })).toBe('day:20260116');
    expect(getRateLimitResetAtIso({ now, window: 'day' })).toBe('2026-01-17T00:00:00.000Z');
    expect(getRetryAfterSeconds({ now, window: 'day' })).toBe(1);
  });
});

