'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { callSendMessage } from '@/lib/callables';
import { Button, Card, Field, Heading, Inline, Section, Stack, Text, Textarea } from '@/design-system';

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
      <Section as="section" size="md">
        <Stack gap={6}>
          <Stack gap={2}>
            <Heading level={1}>Thread</Heading>
            <Text>
              <Link href="/messages">← Back to messages</Link>
            </Text>
            {thread ? (
              <Text size="sm" color="muted">
                Thread: {thread.threadId} | Campaign: {thread.campaignId} | Contract: {thread.contractId ?? '—'}
              </Text>
            ) : null}
          </Stack>

          <Inline gap={3} wrap>
            <Button variant="secondary" onClick={() => refresh().catch(() => undefined)}>
              Refresh
            </Button>
          </Inline>

          {errMsg ? <Text color="error">{errMsg}</Text> : null}

          <Card data-flux-zone="tables">
            <Stack gap={3}>
              {messages.length === 0 ? <Text>No messages.</Text> : null}
              {messages.map((m) => (
                <Stack key={m.messageId} gap={1}>
                  <Text size="sm" color="muted">
                    <strong>{m.senderUid === uid ? 'You' : m.senderUid}</strong> — {m.createdAt}
                  </Text>
                  <Text whitespace="preWrap">{m.body}</Text>
                </Stack>
              ))}
            </Stack>
          </Card>

          <Stack
            as="form"
            gap={3}
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
            data-flux-zone="forms"
          >
            <Field label="Message" htmlFor="message">
              <Textarea id="message" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
            <div>
              <Button disabled={sending} type="submit" loading={sending}>
                Send
              </Button>
            </div>
          </Stack>
        </Stack>
      </Section>
    </RequireVerified>
  );
}
