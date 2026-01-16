'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RequireVerified } from '@/components/RequireVerified';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { callUpdateArtistProfile } from '@/lib/callables';
import { Button, Card, Field, Heading, Section, Select, Stack, Text, Input, useToast } from '@/design-system';

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
  const { pushToast } = useToast();

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
        <Section as="section" size="md">
          <Stack gap={6}>
            <Stack gap={2}>
              <Heading level={1}>Artist profile</Heading>
              <Text>
                <Link href="/artist/dashboard">← Back to dashboard</Link>
              </Text>
            </Stack>

            {errMsg ? <Text color="error">{errMsg}</Text> : null}

            <Card data-flux-zone="forms">
              <Stack
                as="form"
                gap={4}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErrMsg(null);
                  setSaving(true);
                  try {
                    await callUpdateArtistProfile({ displayName, entityType, country, timezone });
                    await refresh();
                    pushToast({ title: 'Profile saved', variant: 'success' });
                  } catch (e: any) {
                    setErrMsg(e?.message ?? 'Failed to save');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Field label="Display name" htmlFor="displayName" required>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </Field>

                <Field label="Entity type" htmlFor="entityType" required>
                  <Select id="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value as any)}>
                    <option value="individual">Individual</option>
                    <option value="label">Label</option>
                    <option value="management">Management</option>
                  </Select>
                </Field>

                <Field label="Country" htmlFor="country" required helpText="2-letter code (e.g. US)">
                  <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
                </Field>

                <Field label="Timezone (IANA)" htmlFor="timezone" required>
                  <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </Field>

                <div>
                  <Button disabled={saving || !changed} type="submit" loading={saving}>
                    Save profile
                  </Button>
                </div>
              </Stack>
            </Card>
          </Stack>
        </Section>
      </RequireRole>
    </RequireVerified>
  );
}
