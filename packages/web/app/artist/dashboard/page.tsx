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
        <main>
          <h1>Artist dashboard</h1>
          <p style={{ opacity: 0.8 }}>
            <Link href="/artist/profile">Edit profile</Link> | <Link href="/artist/contracts">View contracts</Link> |{' '}
            <Link href="/notifications">Notifications</Link>
          </p>

          <section style={{ marginTop: 24 }}>
            <h2>Create a track</h2>
            <p>Uploads are written directly to Storage; metadata is created via a callable function.</p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                setBusy(true);
                setErrMsg(null);
                try {
                  if (!previewFile) throw new Error('Preview MP3 required');

                  const trackId = crypto.randomUUID();

                  // Upload preview mp3
                  const previewPath = `tracks/${uid}/${trackId}/preview.mp3`;
                  await uploadBytes(storageRef(storage, previewPath), previewFile, { contentType: previewFile.type || 'audio/mpeg' });

                  // Upload cover if provided
                  let coverUploaded = false;
                  if (coverFile) {
                    const coverPath = `tracks/${uid}/${trackId}/cover.jpg`;
                    await uploadBytes(storageRef(storage, coverPath), coverFile, { contentType: coverFile.type || 'image/jpeg' });
                    coverUploaded = true;
                  }

                  await callCreateTrack({
                    trackId,
                    title: trackTitle,
                    artistName: trackArtistName,
                    genre: trackGenre,
                    moodTags: trackMoodTags.split(',').map((s) => s.trim()).filter(Boolean),
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
              <div>
                <label>Track title</label>
                <br />
                <input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} required />
              </div>
              <div style={{ marginTop: 12 }}>
                <label>Artist name</label>
                <br />
                <input value={trackArtistName} onChange={(e) => setTrackArtistName(e.target.value)} required />
              </div>
              <div style={{ marginTop: 12 }}>
                <label>Genre</label>
                <br />
                <input value={trackGenre} onChange={(e) => setTrackGenre(e.target.value)} />
              </div>
              <div style={{ marginTop: 12 }}>
                <label>Mood tags (comma-separated)</label>
                <br />
                <input value={trackMoodTags} onChange={(e) => setTrackMoodTags(e.target.value)} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Preview MP3 (required)</label>
                <br />
                <input type="file" accept="audio/*" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} required />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Cover JPG (optional)</label>
                <br />
                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
              </div>

              <button style={{ marginTop: 12 }} disabled={busy} type="submit">
                Create track
              </button>
            </form>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2>Create a campaign</h2>
            <form
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
                    contentGuidelines: { disclosureTextExample: 'Paid partnership #ad', hashtags: ['#ad'], callToAction: null, doNotInclude: null },
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
              <div>
                <label>Track</label>
                <br />
                <select value={campaignTrackId} onChange={(e) => setCampaignTrackId(e.target.value)} required>
                  <option value="">Select…</option>
                  {trackOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Campaign title</label>
                <br />
                <input value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} required />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Brief</label>
                <br />
                <textarea value={campaignBrief} onChange={(e) => setCampaignBrief(e.target.value)} required rows={5} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Deliverables total</label>
                <br />
                <input type="number" min={1} max={50} value={deliverablesTotal} onChange={(e) => setDeliverablesTotal(parseInt(e.target.value, 10))} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Due days after activation</label>
                <br />
                <input type="number" min={1} max={30} value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value, 10))} />
              </div>

              <div style={{ marginTop: 12 }}>
                <label>Max price per deliverable (cents)</label>
                <br />
                <input type="number" min={500} max={500000} value={maxPriceCents} onChange={(e) => setMaxPriceCents(parseInt(e.target.value, 10))} />
              </div>

              <button style={{ marginTop: 12 }} disabled={busy} type="submit">
                Create campaign (draft)
              </button>
            </form>
          </section>

          {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

          <section style={{ marginTop: 24 }}>
            <h2>Your campaigns</h2>
            <ul>
              {campaigns.map((c) => (
                <li key={c.campaignId}>
                  <Link href={`/artist/campaigns/${c.campaignId}`}>{c.title}</Link> — {c.status}
                </li>
              ))}
            </ul>
          </section>
        </main>
      </RequireRole>
    </RequireVerified>
  );
}
