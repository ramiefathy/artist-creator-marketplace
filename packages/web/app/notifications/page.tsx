'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { callMarkNotificationRead } from '@/lib/callables';

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
      <main>
        <h1>Notifications</h1>
        <p style={{ opacity: 0.8 }}>
          This page shows the 50 most recent in-app notifications. Clicking a notification marks it read.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>
        </div>

        {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

        {items.length === 0 ? <p>No notifications.</p> : null}

        <ul style={{ paddingLeft: 18 }}>
          {items.map((n) => (
            <li key={n.notificationId} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ opacity: n.read ? 0.6 : 1 }}>{n.title}</strong>
                <span style={{ fontSize: 12, opacity: 0.6 }}>{n.type}</span>
                {n.read ? <span style={{ fontSize: 12, opacity: 0.6 }}>(read)</span> : null}
              </div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{n.body}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 12, alignItems: 'center' }}>
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
                  <button
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
                  </button>
                ) : null}

                <span style={{ fontSize: 12, opacity: 0.6 }}>{n.createdAt}</span>
              </div>
            </li>
          ))}
        </ul>
      </main>
      </RequireVerified>
  );
}
