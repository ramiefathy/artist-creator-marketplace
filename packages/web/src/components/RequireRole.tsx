'use client';

import React from 'react';
import { useAuth } from './AuthProvider';
import { ButtonLink } from '@/design-system/components/primitives';
import { Container, Section, Stack } from '@/design-system/components/layout';
import { Heading, Text } from '@/design-system/components/typography';

export function RequireRole({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) {
    return (
      <Container>
        <Section>
          <Text color="muted">Loading…</Text>
        </Section>
      </Container>
    );
  }
  if (!allow.includes(role)) {
    return (
      <Container>
        <Section>
          <Stack gap={4}>
            <Heading level={2}>Access denied</Heading>
            <Text color="muted">
              Your current role (<Text as="span" color="default">{role}</Text>) cannot access this page.
            </Text>
            <div>
              <ButtonLink href="/me" variant="secondary">
                Back to My account
              </ButtonLink>
            </div>
          </Stack>
        </Section>
      </Container>
    );
  }
  return <>{children}</>;
}
