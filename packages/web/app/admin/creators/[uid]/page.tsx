'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callAdminSetCreatorVerification, callAdminGetCreatorEvidenceUrls } from '@/lib/callables';
import { Badge, Button, ButtonLink, Card, Field, Heading, Mono, Section, Stack, Text, Textarea, useToast } from '@/design-system';

export default function AdminCreatorPage({ params }: { params: { uid: string } }) {
  const creatorUid = params.uid;

  const { user, loading, role } = useAuth();
  const { pushToast } = useToast();

  const [profile, setProfile] = useState<any | null>(null);
  const [evidence, setEvidence] = useState<{ urls: string[]; paths: string[] } | null>(null);
  const [notes, setNotes] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const snap = await getDoc(doc(db, 'creatorProfiles', creatorUid));
    setProfile(snap.exists() ? (snap.data() as any) : null);

    try {
      const res: any = await callAdminGetCreatorEvidenceUrls({ creatorUid });
      setEvidence({ urls: (res.data as any).urls ?? [], paths: (res.data as any).paths ?? [] });
    } catch {
      setEvidence(null);
    }
  }

  useEffect(() => {
    if (loading || !user || role !== 'admin') return;
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorUid, loading, user?.uid, role]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Creator verification</Heading>
              <ButtonLink href="/admin/dashboard" variant="secondary" size="sm">
                ← Back to admin dashboard
              </ButtonLink>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {!profile ? <Text color="muted">Creator not found.</Text> : null}

            {profile ? (
              <Stack gap={4}>
                <Card>
                  <Stack gap={2}>
                    <Heading level={2}>{profile.displayName}</Heading>
                    <div>
                      <Badge variant={profile.verificationStatus === 'verified' ? 'success' : profile.verificationStatus === 'pending' ? 'warning' : 'neutral'}>
                        {profile.verificationStatus}
                      </Badge>
                    </div>
                    <Text size="sm" color="muted">
                      UID: {creatorUid}
                    </Text>
                  </Stack>
                </Card>

                <Card>
                  <Stack gap={2}>
                    <Heading level={2}>Profile (raw)</Heading>
                    <Mono as="pre">{JSON.stringify(profile, null, 2)}</Mono>
                  </Stack>
                </Card>

                <Card>
                  <Stack gap={3}>
                    <Heading level={2}>Evidence</Heading>
                    {!evidence ? (
                      <Text color="muted">No evidence URLs available.</Text>
                    ) : (
                      <ul>
                        {evidence.urls.map((u, idx) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer">
                              Open evidence #{idx + 1}
                            </a>
                            {evidence.paths[idx] ? (
                              <Text as="div" size="sm" color="muted">
                                {evidence.paths[idx]}
                              </Text>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Stack>
                </Card>

                <Card>
                  <Stack gap={4}>
                    <Heading level={2}>Decision</Heading>

                    <Field label="Admin notes" htmlFor="notes" helpText="Optional notes for audit trail.">
                      <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                    </Field>

                    <Stack gap={2}>
                      <div>
                        <Button
                          onClick={async () => {
                            setErrMsg(null);
                            try {
                              await callAdminSetCreatorVerification({ creatorUid, status: 'verified', notes: notes || null });
                              await refresh();
                              pushToast({ title: 'Creator verified', variant: 'success' });
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            }
                          }}
                        >
                          Verify
                        </Button>
                      </div>

                      <div>
                        <Button
                          variant="danger"
                          onClick={async () => {
                            setErrMsg(null);
                            try {
                              await callAdminSetCreatorVerification({ creatorUid, status: 'rejected', notes: notes || null });
                              await refresh();
                              pushToast({ title: 'Creator rejected', variant: 'warning' });
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed');
                            }
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </Stack>
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
