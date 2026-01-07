'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { callSendMessage } from '@/lib/callables';

type Thread = { threadId: string; participants: string[]; campaignId: string; contractId: string | null };
type Message = { messageId: string; senderUid: string; body: string; createdAt: string };

export default function ThreadPage({ params }: { params: { id: string } }) {
  const threadId = params.id;
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function refresh() {
    if (!uid) return;
    const threadSnap = await getDoc(doc(db, 'threads', threadId));
    if (!threadSnap.exists()) throw new Error('Thread not found');
    const t = threadSnap.data() as any as Thread;
    if (!Array.isArray(t.participants) || !t.participants.includes(uid)) {
      throw new Error('You do not have access to this thread');
    }
    setThread(t);

    const msgSnaps = await getDocs(
      query(collection(db, 'threads', threadId, 'messages'), orderBy('createdAt', 'asc'), limit(200))
    );
    setMessages(msgSnaps.docs.map((d) => d.data() as any) as Message[]);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load thread'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, threadId]);

  return (
    <RequireVerified>
      <main>
        <h1>Thread</h1>
        <p>
          <Link href="/messages">← Back to messages</Link>
        </p>
        {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

        {thread ? (
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
            Thread: {thread.threadId} | Campaign: {thread.campaignId} | Contract: {thread.contractId ?? '—'}
          </div>
        ) : null}

        <button onClick={() => refresh().catch(() => undefined)}>Refresh</button>

        <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12, maxWidth: 720 }}>
          {messages.length === 0 ? <p>No messages.</p> : null}
          {messages.map((m) => (
            <div key={m.messageId} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                <strong>{m.senderUid === uid ? 'You' : m.senderUid}</strong> — {m.createdAt}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          ))}
        </div>

        <form
          style={{ marginTop: 12 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setErrMsg(null);
            if (!body.trim()) return;
            setSending(true);
            try {
              await callSendMessage({ threadId, body: body.trim() });
              setBody('');
              await refresh();
            } catch (e: any) {
              setErrMsg(e?.message ?? 'Failed to send');
            } finally {
              setSending(false);
            }
          }}
        >
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} style={{ width: 720, maxWidth: '100%' }} />
          <div style={{ marginTop: 8 }}>
            <button disabled={sending} type="submit">
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </main>
    </RequireVerified>
  );
}
