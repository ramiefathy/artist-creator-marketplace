'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { callUpdateArtistProfile } from '@/lib/callables';

type ArtistProfile = {
  uid: string;
  displayName: string;
  entityType: 'individual' | 'label' | 'management';
  country: string;
  timezone: string;
};

export default function ArtistProfilePage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'label' | 'management'>('individual');
  const [country, setCountry] = useState('US');
  const [timezone, setTimezone] = useState('America/New_York');

  async function refresh() {
    if (!uid) return;
    const snap = await getDoc(doc(db, 'artistProfiles', uid));
    if (!snap.exists()) {
      setProfile(null);
      return;
    }
    const p = snap.data() as any as ArtistProfile;
    setProfile(p);
    setDisplayName(p.displayName ?? '');
    setEntityType((p.entityType as any) ?? 'individual');
    setCountry(p.country ?? 'US');
    setTimezone(p.timezone ?? 'America/New_York');
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load profile'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const changed = useMemo(() => {
    if (!profile) return true;
    return (
      profile.displayName !== displayName ||
      profile.entityType !== entityType ||
      profile.country !== country ||
      profile.timezone !== timezone
    );
  }, [profile, displayName, entityType, country, timezone]);

  return (
    <RequireVerified>
      <RequireRole allow={['artist', 'admin']}> 
        <main>
          <h1>Artist profile</h1>
          <p>
            <Link href="/artist/dashboard">← Back to dashboard</Link>
          </p>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrMsg(null);
              setSaving(true);
              try {
                await callUpdateArtistProfile({ displayName, entityType, country, timezone });
                await refresh();
                alert('Saved.');
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed to save');
              } finally {
                setSaving(false);
              }
            }}
          >
            <div style={{ marginTop: 12 }}>
              <label>Display name</label>
              <br />
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: 360 }} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Entity type</label>
              <br />
              <select value={entityType} onChange={(e) => setEntityType(e.target.value as any)}>
                <option value="individual">Individual</option>
                <option value="label">Label</option>
                <option value="management">Management</option>
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Country</label>
              <br />
              <input value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: 180 }} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Timezone (IANA)</label>
              <br />
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} style={{ width: 260 }} />
            </div>

            <div style={{ marginTop: 16 }}>
              <button disabled={saving || !changed} type="submit">
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
