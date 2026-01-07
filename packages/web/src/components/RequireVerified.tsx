'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from './AuthProvider';

export function RequireVerified({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [sent, setSent] = useState(false);

  if (loading) return <p>Loading…</p>;
  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <p>You must be signed in.</p>
        <p>
          <Link href="/login">Go to login</Link>
        </p>
      </div>
    );
  }

  if (!user.emailVerified) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Email verification required</h2>
        <p>Please verify your email address before continuing.</p>
        <button
          onClick={async () => {
            await sendEmailVerification(user);
            setSent(true);
          }}
        >
          Send verification email
        </button>
        {sent ? <p>Verification email sent. After verifying, refresh this page.</p> : null}
      </div>
    );
  }

  return <>{children}</>;
}
