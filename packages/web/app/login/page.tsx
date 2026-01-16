'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button, Field, Heading, Input, Section, Stack, Text } from '@/design-system';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <Section as="section" size="sm">
      <Stack gap={6}>
        <Stack gap={2}>
          <Heading level={1}>Log in</Heading>
          <Text color="muted">Welcome back.</Text>
        </Stack>

        <Stack
          as="form"
          gap={4}
          onSubmit={async (e) => {
            e.preventDefault();
            setErrMsg(null);
            try {
              await signInWithEmailAndPassword(auth, email, password);
              window.location.href = '/me';
            } catch (e: any) {
              setErrMsg(e?.message ?? 'Login failed');
            }
          }}
        >
          <Field label="Email" htmlFor="email" required>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
          </Field>

          <Field label="Password" htmlFor="password" required>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>

          <Button type="submit">Log in</Button>

          {errMsg ? <Text color="error">{errMsg}</Text> : null}
        </Stack>

        <Text size="sm" color="muted">
          Need an account? <Link href="/signup">Sign up</Link>
        </Text>
      </Stack>
    </Section>
  );
}
