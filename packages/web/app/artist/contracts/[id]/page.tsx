'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import {
  callGetContractPdfUrl,
  callGetDeliverableEvidenceUrls,
  callArtistApproveDeliverable,
  callArtistRequestRevision,
  callArtistRejectDeliverable,
  callOpenDispute
} from '@/lib/callables';

export default function ArtistContractPage({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const contractId = params.id;
  const [contract, setContract] = useState<any | null>(null);
  const [deliverable, setDeliverable] = useState<any | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  const threadId = contract ? `c_${contract.campaignId}_u_${contract.creatorUid}` : null;

  async function refresh() {
    const cSnap = await getDoc(doc(db, 'contracts', contractId));
    setContract(cSnap.exists() ? (cSnap.data() as any) : null);

    const dSnap = await getDoc(doc(db, 'deliverables', contractId));
    setDeliverable(dSnap.exists() ? (dSnap.data() as any) : null);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  return (
    <RequireVerified>
      <RequireRole allow={['artist', 'admin']}>
        <main>
          <p>
            <Link href="/artist/dashboard">← Back</Link>
          </p>

          <h1>Contract</h1>

          {searchParams?.success ? <p style={{ color: 'green' }}>Payment completed.</p> : null}
          {searchParams?.canceled ? <p style={{ color: 'crimson' }}>Payment canceled.</p> : null}

          {!contract ? <p>Not found.</p> : null}

          {contract ? (
            <>
              <p>Status: {contract.status}</p>
              <p>Payment: {contract.stripe?.paymentStatus}</p>
              <p>Creator: {contract.creatorUid}</p>

              <button
                onClick={async () => {
                  setErrMsg(null);
                  try {
                    const res: any = await callGetContractPdfUrl({ contractId });
                    const url = (res.data as any)?.url as string;
                    window.open(url, '_blank');
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed');
                  }
                }}
              >
                Open contract PDF
              </button>

              {threadId ? (
                <p style={{ marginTop: 8 }}>
                  <Link href={`/messages/${threadId}`}>Open message thread</Link>
                </p>
              ) : null}

              <h2 style={{ marginTop: 24 }}>Deliverable</h2>
              {!deliverable ? <p>Deliverable not found.</p> : null}
              {deliverable ? (
                <>
                  <p>Status: {deliverable.status}</p>
                  <p>Due: {deliverable.dueAt}</p>
                  {deliverable.submission?.postUrl ? (
                    <p>
                      Post URL:{' '}
                      <a href={deliverable.submission.postUrl} target="_blank" rel="noreferrer">
                        {deliverable.submission.postUrl}
                      </a>
                    </p>
                  ) : null}

                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={async () => {
                        setErrMsg(null);
                        try {
                          const res: any = await callGetDeliverableEvidenceUrls({ deliverableId: deliverable.deliverableId });
                          setEvidenceUrls((res.data as any)?.urls ?? []);
                        } catch (e: any) {
                          setErrMsg(e?.message ?? 'Failed to load evidence URLs');
                        }
                      }}
                    >
                      Load deliverable evidence URLs
                    </button>
                    {deliverable.submission?.evidencePaths?.length ? (
                      <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>Files: {deliverable.submission.evidencePaths.length}</span>
                    ) : null}
                  </div>
                  {evidenceUrls.length ? (
                    <ul>
                      {evidenceUrls.map((u) => (
                        <li key={u}>
                          <a href={u} target="_blank" rel="noreferrer">
                            Open evidence
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {deliverable.status === 'submitted' ? (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <label>Notes (for approval optional; for revision/reject required)</label>
                        <br />
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          onClick={async () => {
                            setErrMsg(null);
                            try {
                              await callArtistApproveDeliverable({ deliverableId: deliverable.deliverableId, notes: notes || null });
                              setNotes('');
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            }
                          }}
                        >
                          Approve & Pay out
                        </button>

                        <button
                          onClick={async () => {
                            setErrMsg(null);
                            try {
                              await callArtistRequestRevision({ deliverableId: deliverable.deliverableId, notes: notes || 'Please revise.' });
                              setNotes('');
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            }
                          }}
                        >
                          Request revision
                        </button>

                        <button
                          onClick={async () => {
                            setErrMsg(null);
                            try {
                              await callArtistRejectDeliverable({ deliverableId: deliverable.deliverableId, notes: notes || 'Rejected.' });
                              setNotes('');
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            }
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </>
                  ) : null}

                  <h3 style={{ marginTop: 24 }}>Dispute</h3>
                  <button
                    onClick={async () => {
                      setErrMsg(null);
                      try {
                        await callOpenDispute({ contractId, reasonCode: 'quality_issue', description: 'Opening dispute from artist.', evidencePaths: [] });
                        alert('Dispute opened.');
                        await refresh();
                      } catch (e: any) {
                        setErrMsg(e?.message ?? 'Failed');
                      }
                    }}
                  >
                    Open dispute
                  </button>
                </>
              ) : null}
            </>
          ) : null}

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
