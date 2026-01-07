import { err } from './errors';
import type { CallableRequest } from 'firebase-functions/v2/https';

export function requireAuth(req: CallableRequest): { uid: string; role: string; emailVerified: boolean; email?: string } {
  if (!req.auth) err('UNAUTHENTICATED', 'Auth required');
  const uid = req.auth.uid;
  const role = (req.auth.token as any).role ?? 'unassigned';
  const emailVerified = !!(req.auth.token as any).email_verified;
  const email = (req.auth.token as any).email ?? undefined;
  return { uid, role, emailVerified, email };
}

export function requireEmailVerified(req: CallableRequest): void {
  const { emailVerified } = requireAuth(req);
  if (!emailVerified) err('FAILED_PRECONDITION', 'EMAIL_NOT_VERIFIED');
}

export function requireRole(req: CallableRequest, allowed: string[]): { uid: string; role: string } {
  const { uid, role } = requireAuth(req);
  if (!allowed.includes(role)) err('PERMISSION_DENIED', 'ACCESS_DENIED');
  return { uid, role };
}

export function requireAdmin(req: CallableRequest): { uid: string } {
  const { uid, role } = requireAuth(req);
  if (role !== 'admin') err('PERMISSION_DENIED', 'NOT_ADMIN');
  return { uid };
}
