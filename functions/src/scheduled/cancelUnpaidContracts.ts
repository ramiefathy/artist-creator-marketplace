import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { db } from '../init';
import { nowIso } from '../utils/firestore';
import { CONTRACT_AUTO_CANCEL_HOURS } from '../shared/constants';
import { createNotification } from '../utils/notifications';

export const cancelUnpaidContracts = onSchedule({ region: 'us-central1', schedule: 'every 60 minutes' }, async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - CONTRACT_AUTO_CANCEL_HOURS * 60 * 60 * 1000).toISOString();
  const nowStr = nowIso();

  const snaps = await db()
    .collection('contracts')
    .where('status', '==', 'pending_payment')
    .where('createdAt', '<', cutoff)
    .limit(200)
    .get();

  for (const doc of snaps.docs) {
    const contract = doc.data() as any;

    // Cancel contract
    await doc.ref.update({ status: 'cancelled', updatedAt: nowStr });

    // Expire deliverable if exists
    await db().collection('deliverables').doc(contract.contractId).set({ status: 'expired', updatedAt: nowStr }, { merge: true });

    // Release campaign slot (avoid negatives; re-open if it was paused because full)
    const campaignRef = db().collection('campaigns').doc(contract.campaignId);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(campaignRef);
      if (!snap.exists) return;
      const c = snap.data() as any;
      const deliverablesTotal = Number(c?.deliverableSpec?.deliverablesTotal ?? 0);
      const currentAccepted = Number(c?.acceptedDeliverablesCount ?? 0);
      const nextAccepted = Math.max(0, currentAccepted - 1);

      const update: Record<string, any> = { acceptedDeliverablesCount: nextAccepted, updatedAt: nowStr };
      // Only auto-reopen campaigns that were auto-paused due to being full.
      if (c.status === 'paused' && c.autoPaused === true && nextAccepted < deliverablesTotal) {
        update.status = 'live';
        update.autoPaused = false;
      }
      tx.update(campaignRef, update);
    });

    await createNotification({
      toUid: contract.artistUid,
      type: 'admin_message',
      title: 'Contract cancelled',
      body: 'A contract was cancelled due to non-payment within 24 hours.',
      link: `/artist/contracts/${contract.contractId}`
    });

    await createNotification({
      toUid: contract.creatorUid,
      type: 'admin_message',
      title: 'Contract cancelled',
      body: 'A contract was cancelled due to non-payment by the artist.',
      link: `/creator/contracts/${contract.contractId}`
    });
  }
});
