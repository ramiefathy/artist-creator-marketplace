import { db } from '../init';
import { err } from './errors';

export async function assertNotBlocked(params: { viewerUid: string; targetUid: string }): Promise<void> {
  if (params.viewerUid === params.targetUid) return;

  const [blockedByTarget, blockedByViewer] = await Promise.all([
    db().collection('blocks').doc(params.targetUid).collection('blocked').doc(params.viewerUid).get(),
    db().collection('blocks').doc(params.viewerUid).collection('blocked').doc(params.targetUid).get()
  ]);

  if (blockedByTarget.exists) err('PERMISSION_DENIED', 'BLOCKED');
  if (blockedByViewer.exists) err('FAILED_PRECONDITION', 'YOU_BLOCKED_USER');
}

