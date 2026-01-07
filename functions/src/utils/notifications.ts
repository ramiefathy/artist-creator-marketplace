import * as admin from 'firebase-admin';
import { db } from '../init';
import type { NotificationType } from '../shared/types';

export async function createNotification(params: {
  toUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
}): Promise<void> {
  const ref = db().collection('notifications').doc();
  await ref.set({
    notificationId: ref.id,
    toUid: params.toUid,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link,
    read: false,
    createdAt: admin.firestore.Timestamp.now().toDate().toISOString()
  });
}
