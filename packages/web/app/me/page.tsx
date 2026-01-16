'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { Button, ButtonLink, Heading, Section, Stack, Text } from '@/design-system';

export default function MePage() {
  const { user, role } = useAuth();
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    (async () => {
      const snap = await getDoc(doc(db, 'publicProfiles', user.uid));
      const h = snap.exists() ? String((snap.data() as any).handle ?? '') : '';
      if (!cancelled) setHandle(h || null);
    })().catch(() => {
      if (!cancelled) setHandle(null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return (
    <RequireAuth>
      <Section as="section" size="md">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>My account</Heading>
            <Text color="muted">Manage your session and onboarding.</Text>
          </Stack>

          <Stack gap={2}>
            <Text>Email: {user?.email}</Text>
            <Text>Email verified: {String(user?.emailVerified)}</Text>
            <Text>Role: {role}</Text>
            {handle ? (
              <Text>
                Public profile: <Link href={`/u/${handle}`}>/u/{handle}</Link>
              </Text>
            ) : null}
          </Stack>

          <Stack gap={3}>
            {role === 'unassigned' ? (
              <Text>
                <Link href="/onboarding/role">Complete onboarding</Link>
              </Text>
            ) : null}

            {role === 'artist' ? (
              <ButtonLink href="/artist/dashboard" variant="secondary">
                Go to Artist dashboard
              </ButtonLink>
            ) : null}

            {role === 'creator' ? (
              <ButtonLink href="/creator/dashboard" variant="secondary">
                Go to Creator dashboard
              </ButtonLink>
            ) : null}

            {role === 'admin' ? (
              <ButtonLink href="/admin/dashboard" variant="secondary">
                Go to Admin dashboard
              </ButtonLink>
            ) : null}
          </Stack>

          <Button
            variant="ghost"
            onClick={async () => {
              await signOut(auth);
              window.location.href = '/';
            }}
          >
            Log out
          </Button>
        </Stack>
      </Section>
    </RequireAuth>
  );
}
