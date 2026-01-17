'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callAdminResolveDispute, callGetDisputeEvidenceUrls } from '@/lib/callables';
import { Badge, Button, ButtonLink, Card, Field, Heading, Input, Section, Select, Stack, Text, Textarea, useToast } from '@/design-system';

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

  const { user, loading, role } = useAuth();
  const { pushToast } = useToast();

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
    if (loading || !user || role !== 'admin') return;
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId, loading, user?.uid, role]);

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
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Dispute</Heading>
              <Text color="muted">
                ID: <Text as="span" color="default">{disputeId}</Text>
              </Text>
              <ButtonLink href="/admin/disputes" variant="secondary" size="sm">
                ← Back to disputes
              </ButtonLink>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {dispute ? (
              <Card>
                <Stack gap={4}>
                  <Stack gap={2}>
                    <Text color="muted">Status</Text>
                    <div>
                      <Badge variant={dispute.status === 'open' ? 'warning' : dispute.status === 'under_review' ? 'info' : 'neutral'}>
                        {dispute.status}
                      </Badge>
                    </div>
                  </Stack>

                  <Stack gap={1}>
                    <Text color="muted">Reason</Text>
                    <Text as="div">{dispute.reasonCode}</Text>
                  </Stack>

                  <Stack gap={1}>
                    <Text color="muted">Description</Text>
                    <Text as="div" whitespace="preWrap">
                      {dispute.description}
                    </Text>
                  </Stack>

                  <Stack gap={1}>
                    <Text color="muted">Contract</Text>
                    <Text as="div">
                      <Link href={`/artist/contracts/${dispute.contractId}`}>{dispute.contractId}</Link>{' '}
                      <Text as="span" color="muted">
                        (artist view)
                      </Text>{' '}
                      · <Link href={`/creator/contracts/${dispute.contractId}`}>creator view</Link>
                    </Text>
                    {contract ? (
                      <Text size="sm" color="muted">
                        Contract status: {contract.status} · Payment: {contract.stripe?.paymentStatus ?? 'n/a'} · Payout transfer:{' '}
                        {contract.payout?.transferStatus ?? 'n/a'} · Total: ${(totalCents / 100).toFixed(2)}
                      </Text>
                    ) : null}
                  </Stack>

                  <Stack gap={2}>
                    <Heading level={3}>Evidence</Heading>
                    <Text size="sm" color="muted">
                      Evidence is stored in Firebase Storage and accessed via signed URLs.
                    </Text>
                    <Stack gap={2}>
                      <div>
                        <Button
                          variant="secondary"
                          size="sm"
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
                        </Button>
                      </div>
                      {dispute.evidencePaths?.length ? (
                        <Text size="sm" color="muted">
                          Files: {dispute.evidencePaths.length}
                        </Text>
                      ) : null}
                    </Stack>

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
                      <Text size="sm" color="muted">
                        No evidence URLs loaded.
                      </Text>
                    )}
                  </Stack>
                </Stack>
              </Card>
            ) : (
              <Text color="muted">Loading…</Text>
            )}

            <Card>
              <Stack
                as="form"
                gap={4}
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
                    pushToast({ title: 'Dispute resolved', variant: 'success' });
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed to resolve');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Heading level={2}>Resolve dispute</Heading>

                <Field label="Outcome" htmlFor="outcome" required>
                  <Select
                    id="outcome"
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
                  </Select>
                </Field>

                <Field
                  label="Refund cents"
                  htmlFor="refundCents"
                  helpText={`$${(Number(refundCents || '0') / 100).toFixed(2)}${totalCents ? ` · Total: $${(totalCents / 100).toFixed(2)}` : ''}`}
                >
                  <Input id="refundCents" value={refundCents} onChange={(e) => setRefundCents(e.target.value)} inputMode="numeric" />
                </Field>

                <Field label="Notes (optional)" htmlFor="notes">
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                </Field>

                <div>
                  <Button disabled={busy} type="submit" loading={busy}>
                    Resolve
                  </Button>
                </div>
              </Stack>
            </Card>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
