'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callGetContractPdfUrl, callGetDeliverableEvidenceUrls, callSubmitDeliverable, callOpenDispute } from '@/lib/callables';
import { Badge, Button, ButtonLink, Card, Field, Heading, Input, Section, Stack, Text, Textarea, useToast } from '@/design-system';

export default function CreatorContractPage({ params }: { params: { id: string } }) {
  const contractId = params.id;
  const { user } = useAuth();
  const creatorUid = user?.uid ?? '';
  const { pushToast } = useToast();

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
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Contract</Heading>
              <ButtonLink href="/creator/dashboard" variant="secondary" size="sm">
                ← Back to dashboard
              </ButtonLink>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {!contract ? <Text color="muted">Not found.</Text> : null}

            {contract ? (
              <Stack gap={4}>
                <Card>
                  <Stack gap={2}>
                    <Heading level={2}>Overview</Heading>
                    <Stack gap={1}>
                      <Text color="muted">Status</Text>
                      <div>
                        <Badge variant={contract.status === 'active' ? 'info' : contract.status === 'completed' ? 'success' : 'neutral'}>
                          {contract.status}
                        </Badge>
                      </div>
                    </Stack>
                    <Stack gap={1}>
                      <Text color="muted">Payment</Text>
                      <Text as="div">{contract.stripe?.paymentStatus ?? 'n/a'}</Text>
                    </Stack>
                    <Stack gap={1}>
                      <Text color="muted">Artist UID</Text>
                      <Text as="div">{contract.artistUid}</Text>
                    </Stack>
                    <Stack gap={2}>
                      <div>
                        <Button
                          variant="secondary"
                          size="sm"
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
                      </div>

                      {threadId ? (
                        <div>
                          <ButtonLink href={`/messages/${threadId}`} variant="secondary" size="sm">
                            Open message thread
                          </ButtonLink>
                        </div>
                      ) : null}
                    </Stack>
                  </Stack>
                </Card>

                <Card>
                  <Stack gap={3}>
                    <Heading level={2}>Deliverable</Heading>
                    {!deliverable ? <Text color="muted">Deliverable not found.</Text> : null}
                    {deliverable ? (
                      <Stack gap={3}>
                        <Stack gap={1}>
                          <Text color="muted">Status</Text>
                          <div>
                            <Badge
                              variant={
                                deliverable.status === 'approved'
                                  ? 'success'
                                  : deliverable.status === 'revision_requested'
                                    ? 'warning'
                                    : deliverable.status === 'submitted'
                                      ? 'info'
                                      : 'neutral'
                              }
                            >
                              {deliverable.status}
                            </Badge>
                          </div>
                        </Stack>

                        <Stack gap={1}>
                          <Text color="muted">Due</Text>
                          <Text as="div">{deliverable.dueAt}</Text>
                        </Stack>

                        <Stack gap={2}>
                          <div>
                            <Button
                              variant="secondary"
                              size="sm"
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
                            </Button>
                          </div>
                          {deliverable.submission?.evidencePaths?.length ? (
                            <Text size="sm" color="muted">
                              Files: {deliverable.submission.evidencePaths.length}
                            </Text>
                          ) : null}
                        </Stack>

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
                          <Card>
                            <Stack
                              as="form"
                              gap={4}
                              onSubmit={async (e) => {
                                e.preventDefault();
                                setErrMsg(null);
                                try {
                                  if (!postUrl) throw new Error('Post URL required');

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
                                  pushToast({ title: 'Deliverable submitted', variant: 'success' });
                                } catch (e: any) {
                                  setErrMsg(e?.message ?? 'Failed');
                                }
                              }}
                            >
                              <Heading level={3}>Submit deliverable</Heading>

                              <Field label="Post URL" htmlFor="postUrl" required>
                                <Input id="postUrl" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} required />
                              </Field>

                              <Field label="Notes (optional)" htmlFor="creatorNotes">
                                <Textarea id="creatorNotes" value={creatorNotes} onChange={(e) => setCreatorNotes(e.target.value)} rows={3} />
                              </Field>

                              <Field label="Evidence (optional, up to 3 files)" htmlFor="evidenceFiles">
                                <Input id="evidenceFiles" type="file" multiple onChange={(e) => setEvidenceFiles(e.target.files)} />
                              </Field>

                              <div>
                                <Button type="submit">Submit deliverable</Button>
                              </div>
                            </Stack>
                          </Card>
                        ) : null}

                        <Stack gap={2}>
                          <Heading level={3}>Dispute</Heading>
                          <div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                setErrMsg(null);
                                try {
                                  await callOpenDispute({
                                    contractId,
                                    reasonCode: 'other',
                                    description: 'Opening dispute from creator.',
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
                          </div>
                        </Stack>
                      </Stack>
                    ) : null}
                  </Stack>
                </Card>
              </Stack>
            ) : null}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
