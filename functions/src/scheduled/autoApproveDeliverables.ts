import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../init';
import { nowIso } from '../utils/firestore';
import { DELIVERABLE_AUTO_APPROVE_HOURS } from '../shared/constants';
import { payoutCreatorForContract } from '../utils/payout';
import { STRIPE_SECRET_KEY } from '../config';
import { createNotification } from '../utils/notifications';

export const autoApproveDeliverables = onSchedule(
  { region: 'us-central1', schedule: 'every 60 minutes', secrets: [STRIPE_SECRET_KEY] },
  async () => {
    const now = new Date();
    const cutoff = new Date(now.getTime() - DELIVERABLE_AUTO_APPROVE_HOURS * 60 * 60 * 1000).toISOString();
    const nowStr = nowIso();

    const snaps = await db().collection('deliverables').where('status', '==', 'submitted').limit(200).get();

    for (const doc of snaps.docs) {
      const d = doc.data() as any;
      const submittedAt: string | null = d.submission?.submittedAt ?? null;
      if (!submittedAt) continue;
      if (submittedAt > cutoff) continue;

      // Do not auto-approve if the associated contract is not in an active, paid state
      // (e.g., disputed, cancelled, pending payment). This avoids paying out during disputes.
      const contractSnap = await db().collection('contracts').doc(d.contractId).get();
      if (!contractSnap.exists) continue;
      const contract = contractSnap.data() as any;
      if (contract.status !== 'active') continue;
      if (contract.stripe?.paymentStatus !== 'paid') continue;

      // Auto-approve
      await doc.ref.update({
        status: 'approved',
        review: { artistDecision: 'approved', artistNotes: 'Auto-approved after 72 hours.', reviewedAt: nowStr },
        updatedAt: nowStr
      });

      // Payout + completion
      try {
        await payoutCreatorForContract(d.contractId);
      } catch {
        // Swallow; payout util already guards conditions.
      }

      await createNotification({
        toUid: d.artistUid,
        type: 'deliverable_approved',
        title: 'Deliverable auto-approved',
        body: 'A deliverable was auto-approved after the review window elapsed.',
        link: `/artist/contracts/${d.contractId}`
      });

      await createNotification({
        toUid: d.creatorUid,
        type: 'deliverable_approved',
        title: 'Deliverable auto-approved',
        body: 'Your deliverable was auto-approved after the review window elapsed.',
        link: `/creator/contracts/${d.contractId}`
      });
    }
  }
);
