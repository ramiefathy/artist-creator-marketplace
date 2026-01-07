'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callAdminResolveDispute, callGetDisputeEvidenceUrls } from '@/lib/callables';

type Dispute = {
  disputeId: string;
  contractId: string;
  artistUid: string;
  creatorUid: string;
  status: string;
  reasonCode: string;
  description: string;
  evidencePaths: string[];
  createdAt: string;
  updatedAt: string;
};

type Contract = {
  contractId: string;
  status: string;
  pricing?: { totalPriceCents?: number };
  stripe?: { paymentStatus?: string; paymentIntentId?: string | null };
  payout?: { transferStatus?: string };
};

export default function AdminDisputeDetailPage({ params }: { params: { id: string } }) {
  const disputeId = params.id;

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  const [outcome, setOutcome] = useState<'resolved_no_refund' | 'resolved_refund' | 'resolved_partial_refund'>('resolved_no_refund');
  const [refundCents, setRefundCents] = useState('0');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const ds = await getDoc(doc(db, 'disputes', disputeId));
    if (!ds.exists()) throw new Error('Dispute not found');
    const d = ds.data() as any as Dispute;
    setDispute(d);

    const cs = await getDoc(doc(db, 'contracts', d.contractId));
    if (cs.exists()) setContract(cs.data() as any);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId]);

  const totalCents = contract?.pricing?.totalPriceCents ?? 0;

  const suggestedRefundCents = useMemo(() => {
    if (outcome === 'resolved_refund') return String(totalCents);
    if (outcome === 'resolved_no_refund') return '0';
    // partial refund default: 50%
    return String(Math.floor(totalCents / 2));
  }, [outcome, totalCents]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <main>
          <h1>Dispute: {disputeId}</h1>
          <p>
            <Link href="/admin/disputes">← Back to disputes</Link>
          </p>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

          {dispute ? (
            <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, maxWidth: 820 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Status: {dispute.status}</div>
              <div style={{ marginTop: 8 }}>
                <strong>Reason:</strong> {dispute.reasonCode}
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Description:</strong>
                <div style={{ whiteSpace: 'pre-wrap' }}>{dispute.description}</div>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                Contract: <Link href={`/artist/contracts/${dispute.contractId}`}>{dispute.contractId}</Link> (artist view)
                {' | '}
                <Link href={`/creator/contracts/${dispute.contractId}`}>creator view</Link>
              </div>

              {contract ? (
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  Contract status: {contract.status} | Payment: {contract.stripe?.paymentStatus ?? 'n/a'} | Payout transfer: {contract.payout?.transferStatus ?? 'n/a'} | Total: ${
                    (totalCents / 100).toFixed(2)
                  }
                </div>
              ) : null}

              <h3 style={{ marginTop: 16 }}>Evidence</h3>
              <p style={{ fontSize: 12, opacity: 0.8 }}>Evidence is stored in Firebase Storage and accessed via signed URLs.</p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={async () => {
                    setErrMsg(null);
                    try {
                      const res: any = await callGetDisputeEvidenceUrls({ disputeId });
                      setEvidenceUrls((res.data as any)?.urls ?? []);
                    } catch (e: any) {
                      setErrMsg(e?.message ?? 'Failed to fetch evidence URLs');
                    }
                  }}
                >
                  Load evidence URLs
                </button>
                {dispute.evidencePaths?.length ? <span style={{ fontSize: 12, opacity: 0.7 }}>Files: {dispute.evidencePaths.length}</span> : null}
              </div>
              {evidenceUrls.length ? (
                <ul>
                  {evidenceUrls.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 12, opacity: 0.7 }}>No evidence URLs loaded.</p>
              )}
            </div>
          ) : (
            <p>Loading…</p>
          )}

          <h2 style={{ marginTop: 24 }}>Resolve dispute</h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrMsg(null);
              setBusy(true);
              try {
                await callAdminResolveDispute({
                  disputeId,
                  outcome,
                  refundCents: Number(refundCents),
                  notes: notes.trim() || null
                });
                await refresh();
                alert('Resolved.');
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed to resolve');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div style={{ marginTop: 8 }}>
              <label>Outcome</label>
              <br />
              <select
                value={outcome}
                onChange={(e) => {
                  const v = e.target.value as any;
                  setOutcome(v);
                  setRefundCents(suggestedRefundCents);
                }}
              >
                <option value="resolved_no_refund">Resolved — no refund</option>
                <option value="resolved_refund">Resolved — full refund</option>
                <option value="resolved_partial_refund">Resolved — partial refund</option>
              </select>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Refund cents</label>
              <br />
              <input value={refundCents} onChange={(e) => setRefundCents(e.target.value)} style={{ width: 160 }} />
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                (${(Number(refundCents || '0') / 100).toFixed(2)})
              </span>
              {totalCents ? (
                <span style={{ marginLeft: 12, fontSize: 12, opacity: 0.7 }}>
                  Total: ${
                    (totalCents / 100).toFixed(2)
                  }
                </span>
              ) : null}
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Notes (optional)</label>
              <br />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ width: 620, maxWidth: '100%' }} />
            </div>

            <div style={{ marginTop: 12 }}>
              <button disabled={busy} type="submit">
                {busy ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
          </form>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
