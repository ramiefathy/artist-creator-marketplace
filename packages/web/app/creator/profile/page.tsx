'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { callUpdateCreatorProfile } from '@/lib/callables';
import { Badge, Button, ButtonLink, Card, Field, Grid, Heading, Input, Section, Stack, Text, Textarea, useToast } from '@/design-system';

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
  const { pushToast } = useToast();

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
        <Section as="section" size="lg">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Creator profile</Heading>
              <ButtonLink href="/creator/dashboard" variant="secondary" size="sm">
                ← Back to dashboard
              </ButtonLink>
              {profile ? (
                <Text color="muted">
                  Verification status:{' '}
                  <Badge variant={profile.verificationStatus === 'verified' ? 'success' : profile.verificationStatus === 'pending' ? 'warning' : 'neutral'}>
                    {profile.verificationStatus}
                  </Badge>
                </Text>
              ) : null}
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            <Card>
              <Stack
                as="form"
                gap={5}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErrMsg(null);
                  setSaving(true);
                  try {
                    await callUpdateCreatorProfile(payload);
                    await refresh();
                    pushToast({ title: 'Profile saved', variant: 'success' });
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed to save');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Heading level={2}>Basics</Heading>

                <Field label="Display name" htmlFor="displayName" required>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                </Field>

                <Field label="Bio" htmlFor="bio">
                  <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
                </Field>

                <Field label="Niches (comma-separated)" htmlFor="nichesCsv" helpText="Example: pop, edm, hip-hop">
                  <Input id="nichesCsv" value={nichesCsv} onChange={(e) => setNichesCsv(e.target.value)} />
                </Field>

                <Field label="Audience countries (comma-separated, ISO2)" htmlFor="audienceCountriesCsv" helpText="Example: US, CA, GB">
                  <Input
                    id="audienceCountriesCsv"
                    value={audienceCountriesCsv}
                    onChange={(e) => setAudienceCountriesCsv(e.target.value)}
                    autoComplete="off"
                  />
                </Field>

                <Heading level={3}>Handles</Heading>
                <Grid minItemWidth={220} gap={3}>
                  <Field label="TikTok" htmlFor="tiktokHandle">
                    <Input id="tiktokHandle" value={tiktokHandle} onChange={(e) => setTiktokHandle(e.target.value)} />
                  </Field>
                  <Field label="Instagram" htmlFor="instagramHandle">
                    <Input id="instagramHandle" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} />
                  </Field>
                  <Field label="YouTube" htmlFor="youtubeHandle">
                    <Input id="youtubeHandle" value={youtubeHandle} onChange={(e) => setYoutubeHandle(e.target.value)} />
                  </Field>
                </Grid>

                <Heading level={3}>Self-reported metrics</Heading>
                <Grid minItemWidth={160} gap={3}>
                  <Field label="TikTok followers" htmlFor="tiktokFollowers">
                    <Input id="tiktokFollowers" value={tiktokFollowers} onChange={(e) => setTiktokFollowers(e.target.value)} inputMode="numeric" />
                  </Field>
                  <Field label="TikTok avg views" htmlFor="tiktokAvgViews">
                    <Input id="tiktokAvgViews" value={tiktokAvgViews} onChange={(e) => setTiktokAvgViews(e.target.value)} inputMode="numeric" />
                  </Field>
                  <Field label="Instagram followers" htmlFor="instagramFollowers">
                    <Input
                      id="instagramFollowers"
                      value={instagramFollowers}
                      onChange={(e) => setInstagramFollowers(e.target.value)}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="Instagram avg views" htmlFor="instagramAvgViews">
                    <Input
                      id="instagramAvgViews"
                      value={instagramAvgViews}
                      onChange={(e) => setInstagramAvgViews(e.target.value)}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="YouTube subs" htmlFor="youtubeSubscribers">
                    <Input
                      id="youtubeSubscribers"
                      value={youtubeSubscribers}
                      onChange={(e) => setYoutubeSubscribers(e.target.value)}
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="YouTube avg views" htmlFor="youtubeAvgViews">
                    <Input id="youtubeAvgViews" value={youtubeAvgViews} onChange={(e) => setYoutubeAvgViews(e.target.value)} inputMode="numeric" />
                  </Field>
                </Grid>

                <Stack gap={2}>
                  <div>
                    <Button disabled={saving || !changed} type="submit" loading={saving}>
                      Save profile
                    </Button>
                  </div>
                  {!changed ? <Text size="sm" color="muted">No changes to save.</Text> : null}
                </Stack>
              </Stack>
            </Card>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
