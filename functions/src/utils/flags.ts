import { SOCIAL_ENABLED } from '../config';
import { err } from './errors';

export function parseBooleanFlag(raw: string | undefined | null, defaultValue: boolean): boolean {
  if (raw == null) return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (!v) return defaultValue;

  if (v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'n' || v === 'off') return false;

  return defaultValue;
}

export function isSocialEnabled(): boolean {
  return parseBooleanFlag(SOCIAL_ENABLED.value(), false);
}

export function assertSocialEnabled(): void {
  if (!isSocialEnabled()) err('FAILED_PRECONDITION', 'SOCIAL_DISABLED');
}

