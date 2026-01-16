import { canViewerReadAsset } from '../utils/mediaAccess';

describe('media access', () => {
  test('public asset on public post is readable anonymously', () => {
    expect(
      canViewerReadAsset({
        viewerUid: null,
        viewerIsAdmin: false,
        viewerIsApprovedFollower: false,
        authorUid: 'a',
        authorIsPrivateAccount: false,
        postVisibility: 'public'
      })
    ).toBe(true);
  });

  test('asset on follower-only post is not readable anonymously', () => {
    expect(
      canViewerReadAsset({
        viewerUid: null,
        viewerIsAdmin: false,
        viewerIsApprovedFollower: false,
        authorUid: 'a',
        authorIsPrivateAccount: false,
        postVisibility: 'followers'
      })
    ).toBe(false);
  });

  test('private account makes even public post assets follower-only', () => {
    expect(
      canViewerReadAsset({
        viewerUid: null,
        viewerIsAdmin: false,
        viewerIsApprovedFollower: false,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'public'
      })
    ).toBe(false);
  });

  test('private post assets are author-only even for approved followers', () => {
    expect(
      canViewerReadAsset({
        viewerUid: 'f',
        viewerIsAdmin: false,
        viewerIsApprovedFollower: true,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'private'
      })
    ).toBe(false);
  });
});
