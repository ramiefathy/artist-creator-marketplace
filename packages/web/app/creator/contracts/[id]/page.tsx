'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callGetContractPdfUrl, callGetDeliverableEvidenceUrls, callSubmitDeliverable, callOpenDispute } from '@/lib/callables';

export default function CreatorContractPage({ params }: { params: { id: string } }) {
  const contractId = params.id;
  const { user } = useAuth();
  const creatorUid = user?.uid ?? '';

  const [contract, setContract] = useState<any | null>(null);
  const [deliverable, setDeliverable] = useState<any | null>(null);
  const [postUrl, setPostUrl] = useState('');
  const [creatorNotes, setCreatorNotes] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

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
      <RequireRole allow={['creator', 'admin']}>
        <main>
          <p>
            <Link href="/creator/dashboard">← Back</Link>
          </p>

          <h1>Contract</h1>

          {!contract ? <p>Not found.</p> : null}

          {contract ? (
            <>
              <p>Status: {contract.status}</p>
              <p>Payment: {contract.stripe?.paymentStatus}</p>
              <p>Artist: {contract.artistUid}</p>

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

                  {contract.status === 'active' && ['pending', 'revision_requested'].includes(deliverable.status) ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setErrMsg(null);
                        try {
                          if (!postUrl) throw new Error('Post URL required');

                          // Upload evidence files (optional)
                          const evidencePaths: string[] = [];
                          const files = evidenceFiles ? Array.from(evidenceFiles).slice(0, 3) : [];
                          for (const f of files) {
                            const fileId = `${crypto.randomUUID()}_${f.name}`;
                            const path = `deliverableEvidence/${deliverable.deliverableId}/${contract.artistUid}/${creatorUid}/${fileId}`;
                            await uploadBytes(storageRef(storage, path), f, { contentType: f.type || 'application/octet-stream' });
                            evidencePaths.push(path);
                          }

                          await callSubmitDeliverable({
                            deliverableId: deliverable.deliverableId,
                            postUrl,
                            creatorNotes: creatorNotes || null,
                            compliance: { disclosureConfirmed: true, licenseConfirmed: true, postLiveDaysConfirmed: true },
                            metrics24h: null,
                            evidencePaths
                          });

                          setPostUrl('');
                          setCreatorNotes('');
                          setEvidenceFiles(null);
                          await refresh();
                          alert('Deliverable submitted.');
                        } catch (e: any) {
                          setErrMsg(e?.message ?? 'Failed');
                        }
                      }}
                    >
                      <div>
                        <label>Post URL</label>
                        <br />
                        <input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} required />
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <label>Notes (optional)</label>
                        <br />
                        <textarea value={creatorNotes} onChange={(e) => setCreatorNotes(e.target.value)} rows={3} />
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <label>Evidence (optional, up to 3 files)</label>
                        <br />
                        <input type="file" multiple onChange={(e) => setEvidenceFiles(e.target.files)} />
                      </div>

                      <button style={{ marginTop: 12 }} type="submit">
                        Submit deliverable
                      </button>
                    </form>
                  ) : null}

                  <h3 style={{ marginTop: 24 }}>Dispute</h3>
                  <button
                    onClick={async () => {
                      setErrMsg(null);
                      try {
                        await callOpenDispute({ contractId, reasonCode: 'other', description: 'Opening dispute from creator.', evidencePaths: [] });
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
