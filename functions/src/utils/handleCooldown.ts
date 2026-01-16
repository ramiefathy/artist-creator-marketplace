import { err } from './errors';

export const HANDLE_CHANGE_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;

export function getHandleChangeCooldownRemainingSeconds(params: { nowIso: string; lastChangeIso: string | null }): number {
  if (!params.lastChangeIso) return 0;

  const nowMs = Date.parse(params.nowIso);
  const lastMs = Date.parse(params.lastChangeIso);
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastMs)) return 0;

  const elapsedSeconds = (nowMs - lastMs) / 1000;
  const remaining = HANDLE_CHANGE_COOLDOWN_SECONDS - elapsedSeconds;
  if (!Number.isFinite(remaining)) return 0;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining);
}

export function canChangeHandle(params: { nowIso: string; lastChangeIso: string | null }): boolean {
  return getHandleChangeCooldownRemainingSeconds(params) === 0;
}

export function assertCanChangeHandle(params: { nowIso: string; lastChangeIso: string | null }): void {
  const remainingSeconds = getHandleChangeCooldownRemainingSeconds(params);
  if (remainingSeconds > 0) {
    err('FAILED_PRECONDITION', 'HANDLE_COOLDOWN', { retryAfterSeconds: remainingSeconds });
  }
}

