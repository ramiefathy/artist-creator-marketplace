'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { callMarkNotificationRead } from '@/lib/callables';
import { Button, Card, Heading, Inline, Section, Stack, Text } from '@/design-system';

type Notification = {
  notificationId: string;
  toUid: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [items, setItems] = useState<Notification[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!uid) return;
    const snaps = await getDocs(
      query(collection(db, 'notifications'), where('toUid', '==', uid), orderBy('createdAt', 'desc'), limit(50))
    );
    const list = snaps.docs.map((d) => d.data() as any) as Notification[];
    setItems(list);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load notifications'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return (
    <RequireVerified>
      <Section as="section" size="lg">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>Notifications</Heading>
            <Text color="muted">This page shows the 50 most recent in-app notifications. Opening a notification will mark it read.</Text>
          </Stack>

          <Inline gap={3} wrap>
            <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
              Refresh
            </Button>
          </Inline>

          {errMsg ? <Text color="error">{errMsg}</Text> : null}

          {items.length === 0 ? <Text>No notifications.</Text> : null}

          {items.length > 0 ? (
            <Stack gap={3} as="section">
              {items.map((n) => (
                <Card key={n.notificationId} data-flux-zone="tables">
                  <Stack gap={3}>
                    <Inline gap={2} wrap align="center">
                      <Text as="span" size="lg" color={n.read ? 'muted' : 'default'}>
                        <strong>{n.title}</strong>
                      </Text>
                      <Text as="span" size="sm" color="muted">
                        {n.type}
                      </Text>
                      {n.read ? (
                        <Text as="span" size="sm" color="muted">
                          (read)
                        </Text>
                      ) : null}
                    </Inline>

                    <Text>{n.body}</Text>

                    <Inline gap={3} wrap align="center">
                      <Link
                        href={n.link}
                        onClick={async () => {
                          if (busyId) return;
                          setBusyId(n.notificationId);
                          try {
                            await callMarkNotificationRead({ notificationId: n.notificationId });
                            await refresh();
                          } catch {
                            // read-mark failure should not block navigation
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        Open
                      </Link>

                      {!n.read ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === n.notificationId}
                          onClick={async () => {
                            setBusyId(n.notificationId);
                            try {
                              await callMarkNotificationRead({ notificationId: n.notificationId });
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed to mark read');
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          Mark read
                        </Button>
                      ) : null}

                      <Text as="span" size="sm" color="muted">
                        {n.createdAt}
                      </Text>
                    </Inline>
                  </Stack>
                </Card>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Section>
    </RequireVerified>
  );
}
