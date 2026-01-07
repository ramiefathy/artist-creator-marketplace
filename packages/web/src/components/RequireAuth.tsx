'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
  return <>{children}</>;
}
