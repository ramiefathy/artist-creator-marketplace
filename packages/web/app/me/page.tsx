'use client';

import React from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';

export default function MePage() {
  const { user, role } = useAuth();

  return (
    <RequireAuth>
      <main>
        <h1>My account</h1>
        <p>Email: {user?.email}</p>
        <p>Email verified: {String(user?.emailVerified)}</p>
        <p>Role: {role}</p>

        {role === 'unassigned' ? (
          <p>
            <Link href="/onboarding/role">Complete onboarding</Link>
          </p>
        ) : null}

        {role === 'artist' ? (
          <p>
            <Link href="/artist/dashboard">Go to Artist dashboard</Link>
          </p>
        ) : null}

        {role === 'creator' ? (
          <p>
            <Link href="/creator/dashboard">Go to Creator dashboard</Link>
          </p>
        ) : null}

        {role === 'admin' ? (
          <p>
            <Link href="/admin/dashboard">Go to Admin dashboard</Link>
          </p>
        ) : null}

        <button
          style={{ marginTop: 12 }}
          onClick={async () => {
            await signOut(auth);
            window.location.href = '/';
          }}
        >
          Log out
        </button>
      </main>
    </RequireAuth>
  );
}
