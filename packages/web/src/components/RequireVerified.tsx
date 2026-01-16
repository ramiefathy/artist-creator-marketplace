'use client';

import React, { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from './AuthProvider';
import { Button, ButtonLink } from '@/design-system/components/primitives';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';

export function RequireVerified({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [sent, setSent] = useState(false);

  if (loading) {
    return (
      <Container>
        <Section>
          <Text color="muted">Loading…</Text>
        </Section>
      </Container>
    );
  }
  if (!user) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={2}>Sign in required</Heading>
            <Text color="muted">You must be signed in to view this page.</Text>
            <div>
              <ButtonLink href="/login" variant="primary">
                Go to login
              </ButtonLink>
            </div>
          </Stack>
        </Section>
      </Container>
    );
  }

  if (user.isAnonymous) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={2}>Sign in required</Heading>
            <Text color="muted">
              You’re browsing as a guest. Create an account (or sign in) and verify your email to access marketplace features.
            </Text>
            <div>
              <ButtonLink href="/signup" variant="primary">
                Create account
              </ButtonLink>
            </div>
            <div>
              <ButtonLink href="/login" variant="secondary">
                Log in
              </ButtonLink>
            </div>
          </Stack>
        </Section>
      </Container>
    );
  }

  if (!user.emailVerified) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={2}>Email verification required</Heading>
            <Text color="muted">Please verify your email address before continuing.</Text>
            <div>
              <Button
                variant="primary"
                disabled={sent}
                onClick={async () => {
                  await sendEmailVerification(user);
                  setSent(true);
                }}
              >
                {sent ? 'Verification email sent' : 'Send verification email'}
              </Button>
            </div>
            {sent ? <Text color="muted">After verifying, refresh this page.</Text> : null}
          </Stack>
        </Section>
      </Container>
    );
  }

  return <>{children}</>;
}
