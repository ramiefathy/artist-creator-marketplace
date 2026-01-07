'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callAdminSetCreatorVerification, callAdminGetCreatorEvidenceUrls } from '@/lib/callables';

export default function AdminCreatorPage({ params }: { params: { uid: string } }) {
  const creatorUid = params.uid;

  const [profile, setProfile] = useState<any | null>(null);
  const [evidence, setEvidence] = useState<{ urls: string[]; paths: string[] } | null>(null);
  const [notes, setNotes] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    const snap = await getDoc(doc(db, 'creatorProfiles', creatorUid));
    setProfile(snap.exists() ? (snap.data() as any) : null);

    try {
      const res: any = await callAdminGetCreatorEvidenceUrls({ creatorUid });
      setEvidence({ urls: (res.data as any).urls ?? [], paths: (res.data as any).paths ?? [] });
    } catch {
      setEvidence(null);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorUid]);

  return (
    <RequireVerified>
      <RequireRole allow={['admin']}>
        <main>
          <p>
            <Link href="/admin/dashboard">← Back</Link>
          </p>

          <h1>Creator verification</h1>
          {!profile ? <p>Creator not found.</p> : null}

          {profile ? (
            <>
              <p><strong>{profile.displayName}</strong> — status: {profile.verificationStatus}</p>
              <pre style={{ background: '#f7f7f7', padding: 12, overflowX: 'auto' }}>{JSON.stringify(profile, null, 2)}</pre>

              <h2>Evidence</h2>
              {!evidence ? <p>No evidence URLs available.</p> : null}
              {evidence ? (
                <ul>
                  {evidence.urls.map((u, idx) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer">
                        Open evidence #{idx + 1}
                      </a>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{evidence.paths[idx]}</div>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <label>Admin notes</label>
                <br />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={async () => {
                    setErrMsg(null);
                    try {
                      await callAdminSetCreatorVerification({ creatorUid, status: 'verified', notes: notes || null });
                      await refresh();
                    } catch (e: any) {
                      setErrMsg(e?.message ?? 'Failed');
                    }
                  }}
                >
                  Verify
                </button>

                <button
                  onClick={async () => {
                    setErrMsg(null);
                    try {
                      await callAdminSetCreatorVerification({ creatorUid, status: 'rejected', notes: notes || null });
                      await refresh();
                    } catch (e: any) {
                      setErrMsg(e?.message ?? 'Failed');
                    }
                  }}
                >
                  Reject
                </button>
              </div>
            </>
          ) : null}

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
