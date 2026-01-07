'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callRequestCreatorVerification } from '@/lib/callables';

export default function CreatorVerificationPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [files, setFiles] = useState<FileList | null>(null);
  const [notes, setNotes] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <main>
          <p>
            <Link href="/creator/dashboard">← Back</Link>
          </p>
          <h1>Request verification</h1>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrMsg(null);
              try {
                const list = files ? Array.from(files).slice(0, 5) : [];
                if (list.length === 0) throw new Error('Upload at least one evidence file');

                const evidencePaths: string[] = [];
                for (const f of list) {
                  const fileId = `${crypto.randomUUID()}_${f.name}`;
                  const path = `creatorEvidence/${uid}/${fileId}`;
                  await uploadBytes(storageRef(storage, path), f, { contentType: f.type || 'application/octet-stream' });
                  evidencePaths.push(path);
                }

                await callRequestCreatorVerification({ evidencePaths, notes: notes || null });

                alert('Verification requested.');
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed');
              }
            }}
          >
            <div>
              <label>Evidence files (up to 5)</label>
              <br />
              <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Notes (optional)</label>
              <br />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>

            <button style={{ marginTop: 12 }} type="submit">
              Submit verification request
            </button>
          </form>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
