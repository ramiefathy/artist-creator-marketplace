'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { isSocialEnabled } from '@/lib/flags';
import { cn } from '@/design-system/utils';
import { Container } from '@/design-system/components/layout';
import { Inline } from '@/design-system/components/layout';
import { Text } from '@/design-system/components/typography';
import styles from './NavBar.module.css';

export function NavBar() {
  const { user, role, loading } = useAuth();

  return (
    <header className={styles.header}>
      <Container size="xl">
        <Inline as="nav" align="center" wrap className={styles.nav}>
          <Link href="/" className={styles.brand}>
            MCMP
          </Link>

          <div className={styles.links}>
            {!loading && !user ? (
              <Inline gap={3} align="center" wrap>
                {isSocialEnabled() ? (
                  <Link href="/explore" className={styles.link}>
                    Explore
                  </Link>
                ) : null}
                <Link href="/login" className={styles.link}>
                  Log in
                </Link>
                <Link href="/signup" className={styles.link}>
                  Sign up
                </Link>
              </Inline>
            ) : null}

            {!loading && user ? (
              <Inline gap={3} align="center" wrap>
                {isSocialEnabled() ? (
                  <>
                    <Link href="/explore" className={styles.link}>
                      Explore
                    </Link>
                    <Link href="/following" className={styles.link}>
                      Following
                    </Link>
                  </>
                ) : null}
                <Link href="/me" className={styles.link}>
                  Account
                </Link>
                <Link href="/notifications" className={styles.link}>
                  Notifications
                </Link>
                <Link href="/messages" className={styles.link}>
                  Messages
                </Link>

                {role === 'artist' ? (
                  <>
                    <Link href="/artist/dashboard" className={styles.link}>
                      Artist dashboard
                    </Link>
                    <Link href="/artist/profile" className={styles.link}>
                      Artist profile
                    </Link>
                    <Link href="/artist/contracts" className={styles.link}>
                      Artist contracts
                    </Link>
                  </>
                ) : null}

                {role === 'creator' ? (
                  <>
                    <Link href="/creator/dashboard" className={styles.link}>
                      Creator dashboard
                    </Link>
                    <Link href="/creator/profile" className={styles.link}>
                      Creator profile
                    </Link>
                    <Link href="/creator/contracts" className={styles.link}>
                      Creator contracts
                    </Link>
                    <Link href="/creator/offers" className={styles.link}>
                      My offers
                    </Link>
                    <Link href="/creator/verification" className={styles.link}>
                      Verification
                    </Link>
                    <Link href="/creator/stripe" className={styles.link}>
                      Stripe
                    </Link>
                  </>
                ) : null}

                {role === 'admin' ? (
                  <>
                    <Link href="/admin/dashboard" className={styles.link}>
                      Admin dashboard
                    </Link>
                    <Link href="/admin/reports" className={styles.link}>
                      Reports
                    </Link>
                    <Link href="/admin/disputes" className={styles.link}>
                      Disputes
                    </Link>
                  </>
                ) : null}

                <Text as="span" size="sm" color="muted" className={cn(styles.userEmail, styles.link)}>
                  {user.email}
                </Text>
              </Inline>
            ) : null}
          </div>
        </Inline>
      </Container>
    </header>
  );
}
