import { canChangeHandle, getHandleChangeCooldownRemainingSeconds, HANDLE_CHANGE_COOLDOWN_SECONDS } from '../utils/handleCooldown';

describe('handle cooldown', () => {
  test('allows first-time handle change when last change is missing', () => {
    expect(canChangeHandle({ nowIso: '2026-01-16T00:00:00.000Z', lastChangeIso: null })).toBe(true);
    expect(getHandleChangeCooldownRemainingSeconds({ nowIso: '2026-01-16T00:00:00.000Z', lastChangeIso: null })).toBe(0);
  });

  test('blocks handle changes within cooldown window', () => {
    const nowIso = '2026-01-16T00:00:00.000Z';
    const lastChangeIso = '2026-01-15T23:00:00.000Z';
    const remaining = getHandleChangeCooldownRemainingSeconds({ nowIso, lastChangeIso });
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(HANDLE_CHANGE_COOLDOWN_SECONDS);
    expect(canChangeHandle({ nowIso, lastChangeIso })).toBe(false);
  });

  test('allows handle changes after cooldown window', () => {
    const nowIso = '2026-01-16T00:00:00.000Z';
    const lastChangeIso = '2026-01-01T00:00:00.000Z';
    expect(getHandleChangeCooldownRemainingSeconds({ nowIso, lastChangeIso })).toBe(0);
    expect(canChangeHandle({ nowIso, lastChangeIso })).toBe(true);
  });
});

