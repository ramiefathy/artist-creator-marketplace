'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { callCreateTrack, callCreateCampaign } from '@/lib/callables';
import { Button, Card, Field, Grid, Heading, Inline, Input, Section, Select, Stack, Text, Textarea } from '@/design-system';

type Track = { trackId: string; title: string; artistName: string; genre: string; createdAt: string };
type Campaign = { campaignId: string; title: string; status: string; createdAt: string; trackId: string };

export default function ArtistDashboard() {
  const { user } = useAuth();
  const uid = user?.uid ?? '';

  const [tracks, setTracks] = useState<Track[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Track form state
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtistName, setTrackArtistName] = useState('');
  const [trackGenre, setTrackGenre] = useState('Pop');
  const [trackMoodTags, setTrackMoodTags] = useState('uplifting, energetic');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Campaign form state
  const [campaignTrackId, setCampaignTrackId] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBrief, setCampaignBrief] = useState('');
  const [deliverablesTotal, setDeliverablesTotal] = useState(1);
  const [dueDays, setDueDays] = useState(7);
  const [maxPriceCents, setMaxPriceCents] = useState(5000);

  async function refresh() {
    if (!uid) return;
    const tracksSnap = await getDocs(query(collection(db, 'tracks'), where('ownerUid', '==', uid)));
    setTracks(tracksSnap.docs.map((d) => d.data() as any));

    const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), where('ownerUid', '==', uid)));
    setCampaigns(campaignsSnap.docs.map((d) => d.data() as any));
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const trackOptions = useMemo(() => tracks.map((t) => ({ value: t.trackId, label: `${t.title} (${t.trackId.slice(0, 8)})` })), [tracks]);

  return (
    <RequireVerified>
      <RequireRole allow={['artist', 'admin']}>
        <Section as="section" size="xl">
          <Stack gap={8}>
            <Stack gap={2}>
              <Heading level={1}>Artist dashboard</Heading>
              <Text color="muted">Create tracks and campaigns, then manage offers and contracts.</Text>
              <Inline gap={3} wrap>
                <Link href="/artist/profile">Edit profile</Link>
                <Link href="/artist/contracts">View contracts</Link>
                <Link href="/notifications">Notifications</Link>
              </Inline>
            </Stack>

              <Card data-flux-zone="forms">
                <Stack gap={4} as="section">
                  <Stack gap={1}>
                    <Heading level={2} size="_2xl">
                      Create a track
                    </Heading>
                    <Text size="sm" color="muted">
                      Uploads are written directly to Storage; metadata is created via a callable function.
                    </Text>
                  </Stack>

                  <Stack
                    as="form"
                    gap={4}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!user) return;
                      setBusy(true);
                      setErrMsg(null);
                      try {
                        if (!previewFile) throw new Error('Preview MP3 required');

                        const trackId = crypto.randomUUID();

                        const previewPath = `tracks/${uid}/${trackId}/preview.mp3`;
                        await uploadBytes(storageRef(storage, previewPath), previewFile, {
                          contentType: previewFile.type || 'audio/mpeg'
                        });

                        let coverUploaded = false;
                        if (coverFile) {
                          const coverPath = `tracks/${uid}/${trackId}/cover.jpg`;
                          await uploadBytes(storageRef(storage, coverPath), coverFile, {
                            contentType: coverFile.type || 'image/jpeg'
                          });
                          coverUploaded = true;
                        }

                        await callCreateTrack({
                          trackId,
                          title: trackTitle,
                          artistName: trackArtistName,
                          genre: trackGenre,
                          moodTags: trackMoodTags
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                          isrc: null,
                          externalLinks: { spotify: null, appleMusic: null, youtube: null, tiktokSound: null },
                          rightsTier: 'tier1_attestation',
                          rightsAttestation: { attestsMasterRights: true, attestsPublishingRights: true, hasCoWritersOrSplits: false },
                          rightsAttestationNotes: null,
                          coverUploaded
                        });

                        setTrackTitle('');
                        setTrackArtistName('');
                        setPreviewFile(null);
                        setCoverFile(null);
                        await refresh();
                      } catch (e: any) {
                        setErrMsg(e?.message ?? 'Failed');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Field label="Track title" htmlFor="trackTitle" required>
                      <Input id="trackTitle" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} required />
                    </Field>
                    <Field label="Artist name" htmlFor="trackArtistName" required>
                      <Input id="trackArtistName" value={trackArtistName} onChange={(e) => setTrackArtistName(e.target.value)} required />
                    </Field>
                    <Field label="Genre" htmlFor="trackGenre">
                      <Input id="trackGenre" value={trackGenre} onChange={(e) => setTrackGenre(e.target.value)} />
                    </Field>
                    <Field label="Mood tags (comma-separated)" htmlFor="trackMoodTags">
                      <Input id="trackMoodTags" value={trackMoodTags} onChange={(e) => setTrackMoodTags(e.target.value)} />
                    </Field>
                    <Field label="Preview MP3" htmlFor="previewFile" required helpText="Required">
                      <Input
                        id="previewFile"
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)}
                        required
                      />
                    </Field>
                    <Field label="Cover image" htmlFor="coverFile" helpText="Optional">
                      <Input id="coverFile" type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
                    </Field>
                    <div>
                      <Button disabled={busy} type="submit">
                        Create track
                      </Button>
                    </div>
                  </Stack>
                </Stack>
              </Card>

              <Card data-flux-zone="forms">
                <Stack gap={4} as="section">
                  <Stack gap={1}>
                    <Heading level={2} size="_2xl">
                      Create a campaign
                    </Heading>
                    <Text size="sm" color="muted">
                      Campaigns start as draft. Publish after you review the details.
                    </Text>
                  </Stack>

                  <Stack
                    as="form"
                    gap={4}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!campaignTrackId) {
                        setErrMsg('Select a track first');
                        return;
                      }
                      setBusy(true);
                      setErrMsg(null);
                      try {
                        await callCreateCampaign({
                          trackId: campaignTrackId,
                          title: campaignTitle,
                          brief: campaignBrief,
                          platforms: ['tiktok'],
                          deliverableSpec: { deliverablesTotal, deliverableType: 'tiktok_post', dueDaysAfterActivation: dueDays },
                          contentGuidelines: {
                            disclosureTextExample: 'Paid partnership #ad',
                            hashtags: ['#ad'],
                            callToAction: null,
                            doNotInclude: null
                          },
                          pricing: { maxPricePerDeliverableCents: maxPriceCents }
                        });

                        setCampaignTitle('');
                        setCampaignBrief('');
                        await refresh();
                      } catch (e: any) {
                        setErrMsg(e?.message ?? 'Failed');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Field label="Track" htmlFor="campaignTrackId" required>
                      <Select id="campaignTrackId" value={campaignTrackId} onChange={(e) => setCampaignTrackId(e.target.value)} required>
                        <option value="">Select…</option>
                        {trackOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Campaign title" htmlFor="campaignTitle" required>
                      <Input id="campaignTitle" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} required />
                    </Field>

                    <Field label="Brief" htmlFor="campaignBrief" required>
                      <Textarea id="campaignBrief" value={campaignBrief} onChange={(e) => setCampaignBrief(e.target.value)} required rows={5} />
                    </Field>

                    <Grid gap={4} minItemWidth={220}>
                      <Field label="Deliverables total" htmlFor="deliverablesTotal" required>
                        <Input
                          id="deliverablesTotal"
                          type="number"
                          min={1}
                          max={50}
                          value={deliverablesTotal}
                          onChange={(e) => setDeliverablesTotal(parseInt(e.target.value, 10))}
                        />
                      </Field>
                      <Field label="Due days after activation" htmlFor="dueDays" required>
                        <Input
                          id="dueDays"
                          type="number"
                          min={1}
                          max={30}
                          value={dueDays}
                          onChange={(e) => setDueDays(parseInt(e.target.value, 10))}
                        />
                      </Field>
                      <Field label="Max price per deliverable (cents)" htmlFor="maxPriceCents" required>
                        <Input
                          id="maxPriceCents"
                          type="number"
                          min={500}
                          max={500000}
                          value={maxPriceCents}
                          onChange={(e) => setMaxPriceCents(parseInt(e.target.value, 10))}
                        />
                      </Field>
                    </Grid>

                    <div>
                      <Button disabled={busy} type="submit">
                        Create campaign (draft)
                      </Button>
                    </div>
                  </Stack>
                </Stack>
              </Card>

              {errMsg ? <Text color="error">{errMsg}</Text> : null}

              <Stack gap={3} as="section" data-flux-zone="tables">
                <Heading level={2} size="_2xl">
                  Your campaigns
                </Heading>
                {campaigns.length === 0 ? <Text color="muted">No campaigns yet.</Text> : null}
                {campaigns.length > 0 ? (
                  <Stack gap={2}>
                    {campaigns.map((c) => (
                      <Card key={c.campaignId}>
                        <Inline gap={3} wrap align="center">
                          <Link href={`/artist/campaigns/${c.campaignId}`}>{c.title}</Link>
                          <Text as="span" size="sm" color="muted">
                            {c.status}
                          </Text>
                        </Inline>
                      </Card>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
