'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { callUpdateCreatorProfile } from '@/lib/callables';

type CreatorProfile = {
  uid: string;
  displayName: string;
  bio: string | null;
  niches: string[];
  platformHandles: {
    tiktok: string | null;
    instagram: string | null;
    youtube: string | null;
  };
  audienceCountries: string[];
  metricsSelfReported: {
    tiktokFollowers: number;
    tiktokAvgViews: number;
    instagramFollowers: number;
    instagramAvgViews: number;
    youtubeSubscribers: number;
    youtubeAvgViews: number;
  };
  verificationStatus: string;
};

function parseCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function CreatorProfilePage() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [nichesCsv, setNichesCsv] = useState('');
  const [audienceCountriesCsv, setAudienceCountriesCsv] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [youtubeHandle, setYoutubeHandle] = useState('');

  const [tiktokFollowers, setTiktokFollowers] = useState('0');
  const [tiktokAvgViews, setTiktokAvgViews] = useState('0');
  const [instagramFollowers, setInstagramFollowers] = useState('0');
  const [instagramAvgViews, setInstagramAvgViews] = useState('0');
  const [youtubeSubscribers, setYoutubeSubscribers] = useState('0');
  const [youtubeAvgViews, setYoutubeAvgViews] = useState('0');

  async function refresh() {
    if (!uid) return;
    const snap = await getDoc(doc(db, 'creatorProfiles', uid));
    if (!snap.exists()) {
      setProfile(null);
      return;
    }
    const p = snap.data() as any as CreatorProfile;
    setProfile(p);
    setDisplayName(p.displayName ?? '');
    setBio(p.bio ?? '');
    setNichesCsv((p.niches ?? []).join(', '));
    setAudienceCountriesCsv((p.audienceCountries ?? []).join(', '));
    setTiktokHandle(p.platformHandles?.tiktok ?? '');
    setInstagramHandle(p.platformHandles?.instagram ?? '');
    setYoutubeHandle(p.platformHandles?.youtube ?? '');
    setTiktokFollowers(String(p.metricsSelfReported?.tiktokFollowers ?? 0));
    setTiktokAvgViews(String(p.metricsSelfReported?.tiktokAvgViews ?? 0));
    setInstagramFollowers(String(p.metricsSelfReported?.instagramFollowers ?? 0));
    setInstagramAvgViews(String(p.metricsSelfReported?.instagramAvgViews ?? 0));
    setYoutubeSubscribers(String(p.metricsSelfReported?.youtubeSubscribers ?? 0));
    setYoutubeAvgViews(String(p.metricsSelfReported?.youtubeAvgViews ?? 0));
  }

  useEffect(() => {
    refresh().catch((e: any) => setErrMsg(e?.message ?? 'Failed to load profile'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const payload = useMemo(() => {
    return {
      displayName,
      bio: bio.trim() ? bio : null,
      niches: parseCsv(nichesCsv),
      platformHandles: {
        tiktok: tiktokHandle.trim() ? tiktokHandle.trim() : null,
        instagram: instagramHandle.trim() ? instagramHandle.trim() : null,
        youtube: youtubeHandle.trim() ? youtubeHandle.trim() : null
      },
      audienceCountries: parseCsv(audienceCountriesCsv),
      metricsSelfReported: {
        tiktokFollowers: num(tiktokFollowers),
        tiktokAvgViews: num(tiktokAvgViews),
        instagramFollowers: num(instagramFollowers),
        instagramAvgViews: num(instagramAvgViews),
        youtubeSubscribers: num(youtubeSubscribers),
        youtubeAvgViews: num(youtubeAvgViews)
      }
    };
  }, [displayName, bio, nichesCsv, tiktokHandle, instagramHandle, youtubeHandle, audienceCountriesCsv, tiktokFollowers, tiktokAvgViews, instagramFollowers, instagramAvgViews, youtubeSubscribers, youtubeAvgViews]);

  const changed = useMemo(() => {
    if (!profile) return true;
    // crude diff based on serialized fields for MVP
    const now = JSON.stringify(payload);
    const prev = JSON.stringify({
      displayName: profile.displayName ?? '',
      bio: profile.bio ?? null,
      niches: profile.niches ?? [],
      platformHandles: profile.platformHandles ?? { tiktok: null, instagram: null, youtube: null },
      audienceCountries: profile.audienceCountries ?? [],
      metricsSelfReported: profile.metricsSelfReported ?? {
        tiktokFollowers: 0,
        tiktokAvgViews: 0,
        instagramFollowers: 0,
        instagramAvgViews: 0,
        youtubeSubscribers: 0,
        youtubeAvgViews: 0
      }
    });
    return now !== prev;
  }, [profile, payload]);

  return (
    <RequireVerified>
      <RequireRole allow={['creator', 'admin']}>
        <main>
          <h1>Creator profile</h1>
          <p>
            <Link href="/creator/dashboard">← Back to dashboard</Link>
          </p>

          {profile ? (
            <p style={{ opacity: 0.8 }}>
              Verification status: <strong>{profile.verificationStatus}</strong>
            </p>
          ) : null}

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrMsg(null);
              setSaving(true);
              try {
                await callUpdateCreatorProfile(payload);
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
              <label>Bio</label>
              <br />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} style={{ width: 480 }} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Niches (comma-separated)</label>
              <br />
              <input value={nichesCsv} onChange={(e) => setNichesCsv(e.target.value)} style={{ width: 480 }} />
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Audience countries (comma-separated, ISO2)</label>
              <br />
              <input value={audienceCountriesCsv} onChange={(e) => setAudienceCountriesCsv(e.target.value)} style={{ width: 480 }} />
            </div>

            <h3 style={{ marginTop: 16 }}>Handles</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <label>TikTok</label>
                <br />
                <input value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} style={{ width: 220 }} />
              </div>
              <div>
                <label>Instagram</label>
                <br />
                <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} style={{ width: 220 }} />
              </div>
              <div>
                <label>YouTube</label>
                <br />
                <input value={youtubeHandle} onChange={(e) => setYoutubeHandle(e.target.value)} style={{ width: 220 }} />
              </div>
            </div>

            <h3 style={{ marginTop: 16 }}>Self-reported metrics</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <label>TikTok followers</label>
                <br />
                <input value={tiktokFollowers} onChange={(e) => setTiktokFollowers(e.target.value)} style={{ width: 140 }} />
              </div>
              <div>
                <label>TikTok avg views</label>
                <br />
                <input value={tiktokAvgViews} onChange={(e) => setTiktokAvgViews(e.target.value)} style={{ width: 140 }} />
              </div>
              <div>
                <label>Instagram followers</label>
                <br />
                <input value={instagramFollowers} onChange={(e) => setInstagramFollowers(e.target.value)} style={{ width: 140 }} />
              </div>
              <div>
                <label>Instagram avg views</label>
                <br />
                <input value={instagramAvgViews} onChange={(e) => setInstagramAvgViews(e.target.value)} style={{ width: 140 }} />
              </div>
              <div>
                <label>YouTube subs</label>
                <br />
                <input value={youtubeSubscribers} onChange={(e) => setYoutubeSubscribers(e.target.value)} style={{ width: 140 }} />
              </div>
              <div>
                <label>YouTube avg views</label>
                <br />
                <input value={youtubeAvgViews} onChange={(e) => setYoutubeAvgViews(e.target.value)} style={{ width: 140 }} />
              </div>
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
