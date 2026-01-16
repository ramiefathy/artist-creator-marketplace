'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { callAdminSetUserStatus, callAdminUpdateReportStatus, callDeleteComment, callDeletePost } from '@/lib/callables';
import { Button, Card, Field, Heading, Inline, Input, Section, Stack, Text } from '@/design-system';

type ReportDoc = {
  reportId: string;
  status: 'open' | 'resolved' | 'dismissed';
  targetType: 'post' | 'comment' | 'user';
  reporterUid: string;
  targetUid: string | null;
  postId: string | null;
  commentId: string | null;
  reasonCode: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolvedByUid?: string | null;
  adminNote?: string | null;
};

export default function AdminReportDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const reportId = String(params?.id ?? '').trim();

  const [report, setReport] = useState<ReportDoc | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  const targetHandleLink = useMemo(() => {
    if (!report?.targetUid) return null;
    return { href: `/u/${report.targetUid}`, label: report.targetUid };
  }, [report?.targetUid]);

  async function refresh() {
    if (!reportId) return;
    const snap = await getDoc(doc(db, 'reports', reportId));
    if (!snap.exists()) {
      setReport(null);
      return;
    }
    const data = snap.data() as any;
    setReport(data as ReportDoc);
    setAdminNote(String(data.adminNote ?? ''));
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load report'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Report</Heading>
              <Text color="muted">
                <Link href="/admin/reports">Back to reports</Link> · <Link href="/admin/dashboard">Admin dashboard</Link>
              </Text>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            {!report ? (
              <Text color="muted">Report not found.</Text>
            ) : (
              <Card>
                <Stack gap={4}>
                  <Stack gap={1}>
                    <Heading level={2}>{report.targetType}</Heading>
                    <Text color="muted">
                      Status: {report.status} · {report.reasonCode} · Created: {report.createdAt}
                    </Text>
                  </Stack>

                  <Stack gap={2}>
                    <Text>
                      <strong>Message:</strong> {report.message}
                    </Text>
                    <Text color="muted">
                      Reporter: <Text as="span" color="default">{report.reporterUid}</Text>
                    </Text>
                    {report.targetUid ? (
                      <Text color="muted">
                        Target uid: <Text as="span" color="default">{report.targetUid}</Text>
                      </Text>
                    ) : null}
                    {report.postId ? (
                      <Text color="muted">
                        Post: <Link href={`/p/${report.postId}`}>{report.postId}</Link>
                      </Text>
                    ) : null}
                    {report.commentId ? <Text color="muted">Comment: {report.commentId}</Text> : null}
                  </Stack>

                  <Stack gap={3} as="section">
                    <Heading level={3}>Admin note</Heading>
                    <Field label="Note" htmlFor="admin-note" helpText="Optional internal note stored on the report.">
                      <Input id="admin-note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
                    </Field>
                    <Inline gap={3} wrap>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          if (!report) return;
                          setBusy(true);
                          setErrMsg(null);
                          try {
                            await callAdminUpdateReportStatus({ reportId: report.reportId, status: report.status, adminNote: adminNote.trim() || null });
                            await refresh();
                          } catch (e: any) {
                            setErrMsg(e?.message ?? 'Failed to save note');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Save note
                      </Button>
                    </Inline>
                  </Stack>

                  <Stack gap={3} as="section">
                    <Heading level={3}>Actions</Heading>
                    <Inline gap={3} wrap>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setErrMsg(null);
                          try {
                            await callAdminUpdateReportStatus({ reportId: report.reportId, status: 'dismissed', adminNote: adminNote.trim() || null });
                            await refresh();
                          } catch (e: any) {
                            setErrMsg(e?.message ?? 'Failed to dismiss');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Dismiss
                      </Button>

                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setErrMsg(null);
                          try {
                            await callAdminUpdateReportStatus({ reportId: report.reportId, status: 'resolved', adminNote: adminNote.trim() || null });
                            await refresh();
                          } catch (e: any) {
                            setErrMsg(e?.message ?? 'Failed to resolve');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Mark resolved
                      </Button>

                      {report.postId ? (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setErrMsg(null);
                            try {
                              await callDeletePost({ postId: report.postId });
                              await callAdminUpdateReportStatus({ reportId: report.reportId, status: 'resolved', adminNote: adminNote.trim() || null });
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed to delete post');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Delete post
                        </Button>
                      ) : null}

                      {report.postId && report.commentId ? (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setErrMsg(null);
                            try {
                              await callDeleteComment({ postId: report.postId!, commentId: report.commentId! });
                              await callAdminUpdateReportStatus({ reportId: report.reportId, status: 'resolved', adminNote: adminNote.trim() || null });
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed to delete comment');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Delete comment
                        </Button>
                      ) : null}

                      {report.targetUid ? (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setErrMsg(null);
                            try {
                              await callAdminSetUserStatus({ uid: report.targetUid!, status: 'suspended' });
                              await refresh();
                            } catch (e: any) {
                              setErrMsg(e?.message ?? 'Failed to suspend user');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Suspend user
                        </Button>
                      ) : null}
                    </Inline>

                    {user ? (
                      <Text color="muted" size="sm">
                        Acting as admin uid: {user.uid}
                      </Text>
                    ) : null}
                  </Stack>
                </Stack>
              </Card>
            )}
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}

