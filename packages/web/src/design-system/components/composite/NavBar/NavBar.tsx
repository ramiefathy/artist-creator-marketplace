'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { isSocialEnabled } from '@/lib/flags';
import { cn } from '@/design-system/utils';
import { Container } from '@/design-system/components/layout';
import { Inline } from '@/design-system/components/layout';
import { Text } from '@/design-system/components/typography';
import { ThemeSwitcher } from '@/design-system/components/theme';
import styles from './NavBar.module.css';

export function NavBar() {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const [handle, setHandle] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    if (role === 'admin') return 'Admin';
    if (role === 'artist') return 'Artist';
    if (role === 'creator') return 'Creator';
    if (user?.isAnonymous) return 'Guest';
    return 'Member';
  }, [role, user?.isAnonymous]);

  useEffect(() => {
    if (!user?.uid) {
      setHandle(null);
      return;
    }

    setHandle(null);
    let cancelled = false;
    getDoc(doc(db, 'publicProfiles', user.uid))
      .then((snap) => {
        if (!snap.exists()) {
          if (!cancelled) setHandle(null);
          return;
        }
        const h = String((snap.data() as any)?.handle ?? '').trim();
        if (!cancelled) setHandle(h || null);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const dashboardHref =
    role === 'artist'
      ? '/artist/dashboard'
      : role === 'creator'
        ? '/creator/dashboard'
        : role === 'admin'
          ? '/admin/dashboard'
          : '/me';

  function linkClass(href: string) {
    const isActive = pathname === href || pathname?.startsWith(`${href}/`);
    return cn(styles.link, isActive && styles.linkActive);
  }

  return (
    <header className={styles.header}>
      <Container size="xl">
        <div className={styles.nav}>
          <div className={styles.left}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandMark}>MCMP</span>
              <span className={styles.brandSub}>Music Campaign Marketplace</span>
            </Link>

            <Inline gap={2} align="center" wrap className={styles.primary}>
              {isSocialEnabled() ? (
                <>
                  <Link href="/explore" className={linkClass('/explore')}>
                    Explore
                  </Link>
                  <Link href="/campaigns" className={linkClass('/campaigns')}>
                    Campaigns
                  </Link>
                  <Link href="/people" className={linkClass('/people')}>
                    People
                  </Link>
                  {user ? (
                    <Link href="/following" className={linkClass('/following')}>
                      Following
                    </Link>
                  ) : null}
                </>
              ) : null}

              {!loading && user ? (
                <Link href={dashboardHref} className={linkClass(dashboardHref)}>
                  Dashboard
                </Link>
              ) : null}

              {!loading && user ? (
                <>
                  {!user.isAnonymous && user.emailVerified ? (
                    <Link href="/messages" className={linkClass('/messages')}>
                      Messages
                    </Link>
                  ) : null}
                  <Link href="/notifications" className={linkClass('/notifications')}>
                    Notifications
                  </Link>
                </>
              ) : null}

              {!loading && !user ? (
                <>
                  <Link href="/login" className={linkClass('/login')}>
                    Log in
                  </Link>
                  <Link href="/signup" className={cn(linkClass('/signup'), styles.linkEmphasis)}>
                    Sign up
                  </Link>
                </>
              ) : null}
            </Inline>
          </div>

          <div className={styles.right}>
            <ThemeSwitcher />

            {!loading && user ? (
              <Link href="/me" className={styles.userChip} aria-label="Open account">
                <span className={styles.userHandle}>{handle ? `@${handle}` : user.email || 'Account'}</span>
                <span className={styles.userRole}>{roleLabel}</span>
              </Link>
            ) : null}
          </div>
        </div>
      </Container>
    </header>
  );
}
