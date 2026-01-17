'use client';

import React from 'react';
import { Avatar, Badge, Card, Heading, Stack, Text } from '@/design-system';
import styles from './ProfileHeader.module.css';

type PublicProfile = {
  uid: string;
  handle: string;
  displayName: string;
  bio: string | null;
  roleLabel: string;
  avatarAssetId: string | null;
  isPrivateAccount: boolean;
  followerCount: number;
  createdAt: string;
  updatedAt: string;
};

function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const handle = profile.handle?.trim() ? profile.handle : 'user';
  const name = profile.displayName?.trim() ? profile.displayName : `@${handle}`;

  return (
    <Card className={styles.card} data-hover="lift">
      <div className={styles.inner}>
        <div className={styles.topRow}>
          <Avatar name={name} size="lg" />

          <div>
            <div className={styles.nameRow}>
              <Heading level={1} size="_3xl">
                {name}
              </Heading>
              <Text size="sm" className={styles.meta}>
                Updated {profile.updatedAt ? fmtIso(profile.updatedAt) : '—'}
              </Text>
            </div>

            <div className={styles.handleLine}>
              <Text size="sm" className={styles.meta}>
                @{handle}
              </Text>
              <Badge variant="neutral" size="sm">
                {profile.roleLabel || 'user'}
              </Badge>
              {profile.isPrivateAccount ? (
                <Badge variant="warning" size="sm">
                  Private account
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  Public account
                </Badge>
              )}
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Followers</span>
                <span className={styles.statValue}>{Number(profile.followerCount ?? 0).toLocaleString()}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Account ID</span>
                <span className={styles.statValue} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 650 }}>
                  {profile.uid.slice(0, 8)}…
                </span>
              </div>
            </div>

            {profile.bio ? (
              <Stack gap={2} className={styles.bio}>
                <Text whitespace="preWrap">{profile.bio}</Text>
              </Stack>
            ) : (
              <Text color="muted" className={styles.bio}>
                No bio yet.
              </Text>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
