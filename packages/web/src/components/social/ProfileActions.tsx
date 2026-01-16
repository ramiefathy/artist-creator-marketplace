'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import {
  callApproveFollower,
  callBlockUser,
  callClaimHandle,
  callMuteUser,
  callRemoveFollower,
  callReportUser,
  callRequestFollow,
  callSetAccountPrivacy,
  callUnblockUser,
  callUnfollow,
  callUnmuteUser
} from '@/lib/callables';
import { Button, Field, Heading, Inline, Input, Stack, Text } from '@/design-system';

type FollowStatus = 'none' | 'requested' | 'approved';

type FollowerRow = { followerUid: string; status: FollowStatus; followerHandle: string | null; createdAt?: string };

function normalizeHandleInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, '');
}

export function ProfileActions(props: { profileUid: string; profileHandle: string; isPrivateAccount: boolean }) {
  const router = useRouter();
  const { user, role } = useAuth();

  const viewerUid = user?.uid ?? null;
  const isOwner = !!viewerUid && viewerUid === props.profileUid;
  const isAdmin = role === 'admin';

  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [handleInput, setHandleInput] = useState(props.profileHandle);
  const [privacy, setPrivacy] = useState<boolean>(props.isPrivateAccount);

  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [followersRequested, setFollowersRequested] = useState<FollowerRow[]>([]);

  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const canManage = isOwner || isAdmin;

  const followerDocRef = useMemo(() => {
    if (!viewerUid) return null;
    return doc(db, 'follows', props.profileUid, 'followers', viewerUid);
  }, [props.profileUid, viewerUid]);

  const blockDocRef = useMemo(() => {
    if (!viewerUid || viewerUid === props.profileUid) return null;
    return doc(db, 'blocks', viewerUid, 'blocked', props.profileUid);
  }, [props.profileUid, viewerUid]);

  const muteDocRef = useMemo(() => {
    if (!viewerUid || viewerUid === props.profileUid) return null;
    return doc(db, 'mutes', viewerUid, 'muted', props.profileUid);
  }, [props.profileUid, viewerUid]);

  async function refreshFollowStatus() {
    if (!followerDocRef) {
      setFollowStatus('none');
      return;
    }
    const snap = await getDoc(followerDocRef);
    if (!snap.exists()) {
      setFollowStatus('none');
      return;
    }
    const status = String((snap.data() as any).status ?? '') as FollowStatus;
    setFollowStatus(status === 'approved' || status === 'requested' ? status : 'none');
  }

  async function refreshBlockMute() {
    if (!blockDocRef || !muteDocRef) {
      setIsBlocked(false);
      setIsMuted(false);
      return;
    }

    const [blockSnap, muteSnap] = await Promise.all([getDoc(blockDocRef), getDoc(muteDocRef)]);
    setIsBlocked(blockSnap.exists());
    setIsMuted(muteSnap.exists());
  }

  async function refreshFollowerRequests() {
    if (!canManage) return;
    const snaps = await getDocs(
      query(collection(db, 'follows', props.profileUid, 'followers'), where('status', '==', 'requested'), limit(50))
    );
    const rows = snaps.docs.map((d) => {
      const data = d.data() as any;
      return { followerUid: String(data.followerUid ?? d.id), status: 'requested' as const, createdAt: String(data.createdAt ?? '') };
    });

    const enriched: FollowerRow[] = await Promise.all(
      rows.map(async (r) => {
        try {
          const p = await getDoc(doc(db, 'publicProfiles', r.followerUid));
          const h = p.exists() ? String((p.data() as any).handle ?? '') : '';
          return { ...r, followerHandle: h || null };
        } catch {
          return { ...r, followerHandle: null };
        }
      })
    );

    setFollowersRequested(enriched);
  }

  useEffect(() => {
    setHandleInput(props.profileHandle);
    setPrivacy(props.isPrivateAccount);
  }, [props.isPrivateAccount, props.profileHandle]);

  useEffect(() => {
    refreshFollowStatus().catch(() => undefined);
    refreshBlockMute().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerUid, props.profileUid]);

  useEffect(() => {
    refreshFollowerRequests().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerUid, props.profileUid, canManage]);

  return (
    <Stack gap={4} as="section">
      {errMsg ? <Text color="error">{errMsg}</Text> : null}

      {!viewerUid ? (
        <Text color="muted">Sign in to follow, post, or manage your profile.</Text>
      ) : !isOwner ? (
        <Inline gap={3} wrap align="center">
          <Button
            variant="primary"
            disabled={busy || isBlocked}
            onClick={async () => {
              if (!viewerUid) return;
              setBusy(true);
              setErrMsg(null);
              try {
                if (followStatus === 'approved' || followStatus === 'requested') {
                  await callUnfollow({ targetUid: props.profileUid });
                } else {
                  await callRequestFollow({ targetUid: props.profileUid });
                }
                await refreshFollowStatus();
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Follow action failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            {followStatus === 'approved' ? 'Unfollow' : followStatus === 'requested' ? 'Cancel request' : 'Follow'}
          </Button>
          <Text color="muted" size="sm">
            {isBlocked
              ? 'Unblock to follow or interact.'
              : followStatus === 'approved'
              ? 'Following'
              : followStatus === 'requested'
                ? 'Requested'
                : props.isPrivateAccount
                  ? 'Request follow'
                  : 'Follow instantly'}
          </Text>

          <Button
            variant={isBlocked ? 'secondary' : 'danger'}
            disabled={busy}
            onClick={async () => {
              if (!viewerUid) return;
              const nextBlocked = !isBlocked;
              if (nextBlocked) {
                const ok = window.confirm(`Block @${props.profileHandle}?`);
                if (!ok) return;
              }

              setBusy(true);
              setErrMsg(null);
              try {
                if (nextBlocked) {
                  await callBlockUser({ targetUid: props.profileUid });
                  await refreshFollowStatus();
                } else {
                  await callUnblockUser({ targetUid: props.profileUid });
                }
                await refreshBlockMute();
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed to update block');
              } finally {
                setBusy(false);
              }
            }}
          >
            {isBlocked ? 'Unblock' : 'Block'}
          </Button>

          <Button
            variant={isMuted ? 'secondary' : 'ghost'}
            disabled={busy || isBlocked}
            onClick={async () => {
              if (!viewerUid) return;
              setBusy(true);
              setErrMsg(null);
              try {
                if (isMuted) {
                  await callUnmuteUser({ targetUid: props.profileUid });
                } else {
                  await callMuteUser({ targetUid: props.profileUid });
                }
                await refreshBlockMute();
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed to update mute');
              } finally {
                setBusy(false);
              }
            }}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>

          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              if (!viewerUid) return;
              const msg = window.prompt('Why are you reporting this user?');
              if (!msg) return;
              setBusy(true);
              setErrMsg(null);
              try {
                await callReportUser({ targetUid: props.profileUid, reasonCode: 'other', message: msg });
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed to report user');
              } finally {
                setBusy(false);
              }
            }}
          >
            Report
          </Button>
        </Inline>
      ) : null}

      {isOwner ? (
        <Stack gap={3} as="section">
          <Heading level={3}>Account</Heading>

          <Inline gap={3} wrap align="center">
            <Text color="muted">Privacy:</Text>
            <Button
              variant={privacy ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setErrMsg(null);
                try {
                  const next = !privacy;
                  setPrivacy(next);
                  await callSetAccountPrivacy({ isPrivateAccount: next });
                } catch (e: any) {
                  setErrMsg(e?.message ?? 'Failed to update privacy');
                  setPrivacy(props.isPrivateAccount);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {privacy ? 'Private' : 'Public'}
            </Button>
            <Text color="muted" size="sm">
              {privacy ? 'Followers must be approved.' : 'Anyone can view public posts.'}
            </Text>
          </Inline>
        </Stack>
      ) : null}

      {isOwner ? (
        <Stack gap={3} as="section">
          <Heading level={3}>Change handle</Heading>

          <Stack
            as="form"
            gap={3}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!viewerUid || busy) return;
              setBusy(true);
              setErrMsg(null);
              try {
                const res = await callClaimHandle({ handle: normalizeHandleInput(handleInput) });
                const next = String((res.data as any)?.handle ?? '').trim();
                if (next) router.push(`/u/${next}`);
              } catch (e: any) {
                setErrMsg(e?.message ?? 'Failed to change handle');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Handle" htmlFor="handle" required helpText="3–24 chars, letters/numbers/underscore. Cooldown applies after changes.">
              <Input id="handle" value={handleInput} onChange={(e) => setHandleInput(e.target.value)} />
            </Field>
            <Inline gap={3} wrap>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save handle'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setHandleInput(props.profileHandle);
                }}
              >
                Reset
              </Button>
            </Inline>
          </Stack>
        </Stack>
      ) : null}

      {isOwner ? (
        <Stack gap={3} as="section">
          <Heading level={3}>Follower requests</Heading>
          {followersRequested.length === 0 ? (
            <Text color="muted">No pending requests.</Text>
          ) : (
            <Stack gap={2}>
              {followersRequested.map((r) => (
                <Inline key={r.followerUid} gap={3} wrap align="center">
                  <Text>
                    {r.followerHandle ? <Link href={`/u/${r.followerHandle}`}>@{r.followerHandle}</Link> : r.followerUid}
                  </Text>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setErrMsg(null);
                      try {
                        await callApproveFollower({ followerUid: r.followerUid });
                        await refreshFollowerRequests();
                      } catch (e: any) {
                        setErrMsg(e?.message ?? 'Failed to approve follower');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setErrMsg(null);
                      try {
                        await callRemoveFollower({ followerUid: r.followerUid });
                        await refreshFollowerRequests();
                      } catch (e: any) {
                        setErrMsg(e?.message ?? 'Failed to remove follower');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Remove
                  </Button>
                </Inline>
              ))}
            </Stack>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
