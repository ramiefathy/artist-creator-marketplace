import { db } from '../init';
import { STRIPE_SECRET_KEY } from '../config';
import { stripeClient } from './stripe';
import { err } from './errors';
import { nowIso } from './firestore';
import { createNotification } from './notifications';

export async function payoutCreatorForContract(contractId: string): Promise<{ transferId: string; amountCents: number }> {
  const contractRef = db().collection('contracts').doc(contractId);
  const snap = await contractRef.get();
  if (!snap.exists) err('NOT_FOUND', 'CONTRACT_NOT_FOUND');
  const contract = snap.data() as any;

  if (contract.stripe?.paymentStatus !== 'paid') err('FAILED_PRECONDITION', 'CONTRACT_NOT_PAID');
  if (contract.status !== 'active' && contract.status !== 'completed') err('FAILED_PRECONDITION', 'CONTRACT_NOT_ACTIVE');

  const payout = contract.payout ?? {};
  if (payout.transferStatus === 'sent' && payout.stripeTransferId) {
    return { transferId: payout.stripeTransferId as string, amountCents: contract.pricing.creatorPayoutTotalCents as number };
  }

  const creatorAccount = payout.creatorStripeAccountId as string;
  if (!creatorAccount) err('FAILED_PRECONDITION', 'CREATOR_STRIPE_ACCOUNT_MISSING');

  const amount = contract.pricing.creatorPayoutTotalCents as number;
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());

  const transfer = await stripe.transfers.create(
    {
      amount,
      currency: 'usd',
      destination: creatorAccount,
      metadata: { contractId }
    },
    { idempotencyKey: `transfer_${contractId}` }
  );

  const now = nowIso();

  await contractRef.update({
    payout: {
      ...contract.payout,
      paidOutCents: amount,
      stripeTransferId: transfer.id,
      transferStatus: 'sent'
    },
    status: 'completed',
    completedAt: now,
    updatedAt: now
  });

  // Persist payout transfer record (idempotent using contractId)
  await db()
    .collection('payoutTransfers')
    .doc(contractId)
    .set(
      {
        id: contractId,
        contractId,
        artistUid: contract.artistUid,
        creatorUid: contract.creatorUid,
        stripeTransferId: transfer.id,
        amountCents: amount,
        currency: 'USD',
        status: 'sent',
        createdAt: now
      },
      { merge: true }
    );

  await createNotification({
    toUid: contract.creatorUid,
    type: 'payout_sent',
    title: 'Payout sent',
    body: `A payout of $${(amount / 100).toFixed(2)} was sent.`,
    link: `/creator/contracts/${contractId}`
  });

  return { transferId: transfer.id, amountCents: amount };
}
