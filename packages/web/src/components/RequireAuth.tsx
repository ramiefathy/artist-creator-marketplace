'use client';

import React from 'react';
import { useAuth } from './AuthProvider';
import { ButtonLink } from '@/design-system/components/primitives';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
  return <>{children}</>;
}
