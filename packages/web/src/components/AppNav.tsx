'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';

export function AppNav() {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (!user) return null;

  const linkStyle: React.CSSProperties = {
    textDecoration: 'none'
  };

  return (
    <nav
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        padding: '12px 0',
        marginBottom: 16,
        borderBottom: '1px solid #eee'
      }}
    >
      <Link href="/me" style={linkStyle}>
        Account
      </Link>
      <Link href="/notifications" style={linkStyle}>
        Notifications
      </Link>

      <Link href="/messages" style={linkStyle}>
        Messages
      </Link>

      {role === 'artist' ? (
        <>
          <Link href="/artist/dashboard" style={linkStyle}>
            Artist dashboard
          </Link>
          <Link href="/artist/profile" style={linkStyle}>
            Artist profile
          </Link>
          <Link href="/artist/contracts" style={linkStyle}>
            Artist contracts
          </Link>
        </>
      ) : null}

      {role === 'creator' ? (
        <>
          <Link href="/creator/dashboard" style={linkStyle}>
            Creator dashboard
          </Link>
          <Link href="/creator/profile" style={linkStyle}>
            Creator profile
          </Link>
          <Link href="/creator/contracts" style={linkStyle}>
            Creator contracts
          </Link>
          <Link href="/creator/offers" style={linkStyle}>
            My offers
          </Link>
          <Link href="/creator/verification" style={linkStyle}>
            Verification
          </Link>
          <Link href="/creator/stripe" style={linkStyle}>
            Stripe
          </Link>
        </>
      ) : null}

      {role === 'admin' ? (
        <>
          <Link href="/admin/dashboard" style={linkStyle}>
            Admin dashboard
          </Link>
          <Link href="/admin/disputes" style={linkStyle}>
            Disputes
          </Link>
        </>
      ) : null}

      <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>{user.email}</span>
    </nav>
  );
}
