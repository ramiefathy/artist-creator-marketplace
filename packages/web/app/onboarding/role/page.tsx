'use client';

import React, { useState } from 'react';
import { RequireVerified } from '@/components/RequireVerified';
import { useAuth } from '@/components/AuthProvider';
import { callSetInitialRole } from '@/lib/callables';

export default function RoleOnboardingPage() {
  const { user, role } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <RequireVerified>
      <main>
        <h1>Choose your role</h1>
        <p>Current role: {role}</p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErrMsg(null);
              try {
                await callSetInitialRole({ role: 'artist' });
                await user?.getIdToken(true);
                window.location.href = '/artist/dashboard';
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            I am an Artist
          </button>

          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErrMsg(null);
              try {
                await callSetInitialRole({ role: 'creator' });
                await user?.getIdToken(true);
                window.location.href = '/creator/dashboard';
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            I am a Creator
          </button>
        </div>

        {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}
      </main>
    </RequireVerified>
  );
}
