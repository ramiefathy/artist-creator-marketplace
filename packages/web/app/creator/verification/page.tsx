'use client';

import React, { useState } from 'react';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callRequestCreatorVerification } from '@/lib/callables';
import { Button, ButtonLink, Card, Field, Heading, Input, Section, Stack, Text, Textarea, useToast } from '@/design-system';

export default function CreatorVerificationPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const { pushToast } = useToast();

  const [files, setFiles] = useState<FileList | null>(null);
  const [notes, setNotes] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Request verification</Heading>
              <ButtonLink href="/creator/dashboard" variant="secondary" size="sm">
                ← Back to dashboard
              </ButtonLink>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            <Card>
              <Stack
                as="form"
                gap={4}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErrMsg(null);
                  try {
                    const list = files ? Array.from(files).slice(0, 5) : [];
                    if (list.length === 0) throw new Error('Upload at least one evidence file');

                    const evidencePaths: string[] = [];
                    for (const f of list) {
                      const fileId = `${crypto.randomUUID()}_${f.name}`;
                      const path = `creatorEvidence/${uid}/${fileId}`;
                      await uploadBytes(storageRef(storage, path), f, { contentType: f.type || 'application/octet-stream' });
                      evidencePaths.push(path);
                    }

                    await callRequestCreatorVerification({ evidencePaths, notes: notes || null });
                    pushToast({ title: 'Verification requested', variant: 'success' });
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed');
                  }
                }}
              >
                <Field label="Evidence files (up to 5)" htmlFor="evidenceFiles" required helpText="Upload screenshots, analytics exports, or other proof of audience/ownership.">
                  <Input id="evidenceFiles" type="file" multiple onChange={(e) => setFiles(e.target.files)} required />
                </Field>

                <Field label="Notes (optional)" htmlFor="notes" helpText="Add any context that helps an admin review your evidence faster.">
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                </Field>

                <div>
                  <Button type="submit">Submit verification request</Button>
                </div>
              </Stack>
            </Card>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
