import { HttpsError } from 'firebase-functions/v2/https';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'FAILED_PRECONDITION'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INTERNAL';

export function err(code: ErrorCode, message: string, details?: Record<string, unknown>): never {
  const firebaseCode = code.toLowerCase().replace(/_/g, '-') as any;
  throw new HttpsError(firebaseCode, message, details ?? null);
}
