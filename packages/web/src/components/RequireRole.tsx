'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export function RequireRole({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const { role, loading } = useAuth();
  if (loading) return <p>Loading…</p>;
  if (!allow.includes(role)) {
    return (
      <div style={{ padding: 24 }}>
        <p>Access denied for role: {role}</p>
        <p>
          <Link href="/me">Back to My account</Link>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
