'use client';

import React, { useState } from 'react';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { callSetInitialRole } from '@/lib/callables';
import { Button, Heading, Inline, Section, Stack, Text } from '@/design-system';

export default function RoleOnboardingPage() {
  const { user, role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <RequireVerified>
      <Section as="section" size="sm">
        <Stack gap={6} data-flux-zone="forms">
          <Stack gap={2}>
            <Heading level={1}>Choose your role</Heading>
            <Text color="muted">Current role: {role}</Text>
          </Stack>

          <Inline gap={3} wrap>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErrMsg(null);
                try {
                  await callSetInitialRole({ role: 'artist' });
                  await user?.getIdToken(true);
                  window.location.href = '/artist/dashboard';
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed');
                } finally {
                  setBusy(false);
                }
              }}
            >
              I am an Artist
            </Button>

            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErrMsg(null);
                try {
                  await callSetInitialRole({ role: 'creator' });
                  await user?.getIdToken(true);
                  window.location.href = '/creator/dashboard';
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed');
                } finally {
                  setBusy(false);
                }
              }}
              variant="secondary"
            >
              I am a Creator
            </Button>
          </Inline>

          {errMsg ? <Text color="error">{errMsg}</Text> : null}
        </Stack>
      </Section>
    </RequireVerified>
  );
}
