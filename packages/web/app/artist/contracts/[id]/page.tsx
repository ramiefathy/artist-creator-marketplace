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
import { Button, Card, Field, Heading, Inline, Section, Stack, Text, Textarea, useToast } from '@/design-system';

export default function ArtistContractPage({ params, searchParams }: { params: { id: string }; searchParams: any }) {
  const contractId = params.id;
  const { pushToast } = useToast();
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
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Contract</Heading>
              <Text>
                <Link href="/artist/dashboard">← Back</Link>
              </Text>
              {searchParams?.success ? <Text>Payment completed.</Text> : null}
              {searchParams?.canceled ? <Text color="error">Payment canceled.</Text> : null}
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {!contract ? <Text>Not found.</Text> : null}

            {contract ? (
              <Stack gap={6}>
                <Card data-flux-zone="tables">
                  <Stack gap={2}>
                    <Text>Status: {contract.status}</Text>
                    <Text>Payment: {contract.stripe?.paymentStatus}</Text>
                    <Text>Creator: {contract.creatorUid}</Text>

                    <Inline gap={3} wrap>
                      <Button
                        variant="secondary"
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
                      </Button>

                      {threadId ? <Link href={`/messages/${threadId}`}>Open message thread</Link> : null}
                    </Inline>
                  </Stack>
                </Card>

                <Stack gap={3} as="section">
                  <Heading level={2} size="_2xl">
                    Deliverable
                  </Heading>
                  {!deliverable ? <Text>Deliverable not found.</Text> : null}
                  {deliverable ? (
                    <Card data-flux-zone="tables">
                      <Stack gap={4}>
                        <Stack gap={1}>
                          <Text>Status: {deliverable.status}</Text>
                          <Text>Due: {deliverable.dueAt}</Text>
                          {deliverable.submission?.postUrl ? (
                            <Text>
                              Post URL:{' '}
                              <a href={deliverable.submission.postUrl} target="_blank" rel="noreferrer">
                                {deliverable.submission.postUrl}
                              </a>
                            </Text>
                          ) : null}
                        </Stack>

                        <Inline gap={3} wrap align="center">
                          <Button
                            variant="secondary"
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
                            Load evidence URLs
                          </Button>
                          {deliverable.submission?.evidencePaths?.length ? (
                            <Text as="span" size="sm" color="muted">
                              Files: {deliverable.submission.evidencePaths.length}
                            </Text>
                          ) : null}
                        </Inline>

                        {evidenceUrls.length ? (
                          <Stack gap={2} as="section">
                            {evidenceUrls.map((u) => (
                              <a key={u} href={u} target="_blank" rel="noreferrer">
                                Open evidence
                              </a>
                            ))}
                          </Stack>
                        ) : null}

                        {deliverable.status === 'submitted' ? (
                          <Stack gap={3} data-flux-zone="forms">
                            <Field label="Notes" htmlFor="notes" helpText="Optional for approval; required for revision/reject.">
                              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                            </Field>

                            <Inline gap={3} wrap>
                              <Button
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
                                Approve &amp; Pay out
                              </Button>

                              <Button
                                variant="secondary"
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
                              </Button>

                              <Button
                                variant="danger"
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
                              </Button>
                            </Inline>
                          </Stack>
                        ) : null}

                        <Stack gap={2} as="section">
                          <Heading level={3} size="xl">
                            Dispute
                          </Heading>
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              setErrMsg(null);
                              try {
                                await callOpenDispute({
                                  contractId,
                                  reasonCode: 'quality_issue',
                                  description: 'Opening dispute from artist.',
                                  evidencePaths: []
                                });
                                pushToast({ title: 'Dispute opened', variant: 'info' });
                                await refresh();
                              } catch (e: any) {
                                setErrMsg(e?.message ?? 'Failed');
                              }
                            }}
                          >
                            Open dispute
                          </Button>
                        </Stack>
                      </Stack>
                    </Card>
                  ) : null}
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
