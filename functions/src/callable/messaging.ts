import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireEmailVerified, requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { err } from '../utils/errors';
import { validateOrThrow } from '../utils/validation';
import { sendMessageSchema } from '../schemas/requests';
import { createNotification } from '../utils/notifications';

type Req = { threadId: string; text: string };

export const sendMessage = onCall({ region: 'us-central1' }, async (req) => {
  requireEmailVerified(req);
  const { uid, role } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<Req>(sendMessageSchema, req.data);
  const now = nowIso();

  const threadRef = db().collection('threads').doc(data.threadId);
  const threadSnap = await threadRef.get();
  if (!threadSnap.exists) err('NOT_FOUND', 'THREAD_NOT_FOUND');

  const thread = threadSnap.data() as any;
  const participants: string[] = Array.isArray(thread.participants) ? thread.participants : [];
  const isParticipant = participants.includes(uid);
  const isAdmin = role === 'admin';

  if (!isParticipant && !isAdmin) err('PERMISSION_DENIED', 'NOT_PARTICIPANT');

  const msgRef = threadRef.collection('messages').doc();
  await msgRef.set({
    messageId: msgRef.id,
    senderUid: uid,
    text: data.text,
    createdAt: now
  });

  await threadRef.update({ lastMessageAt: now, lastMessagePreview: data.text.slice(0, 140), updatedAt: now });

  // Notify the other participant (if applicable)
  if (isParticipant && participants.length === 2) {
    const otherUid = participants[0] === uid ? participants[1] : participants[0];
    await createNotification({
      toUid: otherUid,
      type: 'message',
      title: 'New message',
      body: data.text.slice(0, 140),
      link: `/messages/${data.threadId}`
    });
  }

  return { ok: true, messageId: msgRef.id };
});
