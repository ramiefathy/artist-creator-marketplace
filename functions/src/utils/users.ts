import { db } from '../init';
import { err } from './errors';

export async function requireUserActive(uid: string): Promise<void> {
  const snap = await db().collection('users').doc(uid).get();
  if (!snap.exists) err('NOT_FOUND', 'USER_NOT_FOUND');
  const data = snap.data() as any;
  if (data.status !== 'active') err('PERMISSION_DENIED', 'USER_SUSPENDED');
}
