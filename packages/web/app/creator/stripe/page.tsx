'use client';

import React, { useEffect, useState } from 'react';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callCreatorStartStripeOnboarding, callCreatorRefreshStripeOnboarding, callCreatorSyncStripeOnboardingStatus } from '@/lib/callables';
import { Badge, Button, ButtonLink, Heading, Inline, Section, Stack, Text } from '@/design-system';

export default function CreatorStripePage() {
  const [status, setStatus] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const res: any = await callCreatorSyncStripeOnboardingStatus({});
    setStatus((res.data as any)?.status ?? null);
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Stripe Connect onboarding</Heading>
              <ButtonLink href="/creator/dashboard" variant="secondary" size="sm">
                ← Back to dashboard
              </ButtonLink>
              <Text color="muted">
                Status:{' '}
                <Badge variant={status === 'active' ? 'success' : status ? 'info' : 'neutral'}>
                  {status ?? 'unknown'}
                </Badge>
              </Text>
            </Stack>

            <Inline gap={3} wrap>
              <Button
                onClick={async () => {
                  setErrMsg(null);
                  try {
                    const res: any = await callCreatorStartStripeOnboarding({});
                    const url = (res.data as any)?.url as string;
                    window.location.href = url;
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed');
                  }
                }}
              >
                Start onboarding
              </Button>

              <Button
                variant="secondary"
                onClick={async () => {
                  setErrMsg(null);
                  try {
                    const res: any = await callCreatorRefreshStripeOnboarding({});
                    const url = (res.data as any)?.url as string;
                    window.location.href = url;
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed');
                  }
                }}
              >
                Refresh onboarding link
              </Button>

              <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
                Refresh status
              </Button>
            </Inline>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
