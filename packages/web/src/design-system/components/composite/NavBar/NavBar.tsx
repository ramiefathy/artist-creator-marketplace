'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Container } from '@/design-system/components/layout';
import styles from './NavBar.module.css';

export function NavBar() {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (!user) return null;

  return (
    <header className={styles.header}>
      <Container size="xl" className={styles.inner}>
        <nav className={styles.nav} aria-label="Primary">
          <Link className={styles.link} href="/me">
            Account
          </Link>
          <Link className={styles.link} href="/notifications">
            Notifications
          </Link>
          <Link className={styles.link} href="/messages">
            Messages
          </Link>

          {role === 'artist' ? (
            <>
              <Link className={styles.link} href="/artist/dashboard">
                Artist dashboard
              </Link>
              <Link className={styles.link} href="/artist/profile">
                Artist profile
              </Link>
              <Link className={styles.link} href="/artist/contracts">
                Artist contracts
              </Link>
            </>
          ) : null}

          {role === 'creator' ? (
            <>
              <Link className={styles.link} href="/creator/dashboard">
                Creator dashboard
              </Link>
              <Link className={styles.link} href="/creator/profile">
                Creator profile
              </Link>
              <Link className={styles.link} href="/creator/contracts">
                Creator contracts
              </Link>
              <Link className={styles.link} href="/creator/offers">
                My offers
              </Link>
              <Link className={styles.link} href="/creator/verification">
                Verification
              </Link>
              <Link className={styles.link} href="/creator/stripe">
                Stripe
              </Link>
            </>
          ) : null}

          {role === 'admin' ? (
            <>
              <Link className={styles.link} href="/admin/dashboard">
                Admin dashboard
              </Link>
              <Link className={styles.link} href="/admin/disputes">
                Disputes
              </Link>
            </>
          ) : null}
        </nav>

        <div className={styles.user}>{user.email}</div>
      </Container>
    </header>
  );
}

