'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button, ButtonLink, Field, Heading, Input, Section, Stack, Text } from '@/design-system';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  return (
    <Section as="section" size="sm">
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={1}>Sign up</Heading>
          <Text color="muted">Create an account to get started.</Text>
        </Stack>

        <Stack
          as="form"
          gap={4}
          onSubmit={async (e) => {
            e.preventDefault();
            setErrMsg(null);
            try {
              const cred = await createUserWithEmailAndPassword(auth, email, password);
              await sendEmailVerification(cred.user);
              setCreated(true);
            } catch (e: any) {
              setErrMsg(e?.message ?? 'Sign up failed');
            }
          }}
        >
          <Field label="Email" htmlFor="email" required>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
          </Field>

          <Field label="Password" htmlFor="password" required helpText="Minimum 6 characters">
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              required
              autoComplete="new-password"
            />
          </Field>

          <Button type="submit">Create account</Button>

          {created ? (
            <Stack gap={2}>
              <Text>Account created. Please verify your email, then continue.</Text>
              <ButtonLink href="/me" variant="secondary">
                Go to My account
              </ButtonLink>
            </Stack>
          ) : null}

          {errMsg ? <Text color="error">{errMsg}</Text> : null}
        </Stack>

        <Text size="sm" color="muted">
          Already have an account? <Link href="/login">Log in</Link>
        </Text>
      </Stack>
    </Section>
  );
}
