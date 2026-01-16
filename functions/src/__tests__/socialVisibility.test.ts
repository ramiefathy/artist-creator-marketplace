import { canViewerReadPost } from '../utils/socialVisibility';

describe('social visibility', () => {
  test('admin can read everything', () => {
    expect(
      canViewerReadPost({
        viewerUid: null,
        viewerIsAdmin: true,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'private',
        viewerIsApprovedFollower: false
      })
    ).toBe(true);
  });

  test('author can read own post regardless', () => {
    expect(
      canViewerReadPost({
        viewerUid: 'a',
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'private',
        viewerIsApprovedFollower: false
      })
    ).toBe(true);
  });

  test('public post on public account is readable without auth', () => {
    expect(
      canViewerReadPost({
        viewerUid: null,
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: false,
        postVisibility: 'public',
        viewerIsApprovedFollower: false
      })
    ).toBe(true);
  });

  test('followers-only post requires approved follower', () => {
    expect(
      canViewerReadPost({
        viewerUid: null,
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: false,
        postVisibility: 'followers',
        viewerIsApprovedFollower: false
      })
    ).toBe(false);

    expect(
      canViewerReadPost({
        viewerUid: 'u',
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: false,
        postVisibility: 'followers',
        viewerIsApprovedFollower: true
      })
    ).toBe(true);
  });

  test('private account makes posts follower-only for others', () => {
    expect(
      canViewerReadPost({
        viewerUid: null,
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'public',
        viewerIsApprovedFollower: false
      })
    ).toBe(false);

    expect(
      canViewerReadPost({
        viewerUid: 'u',
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'public',
        viewerIsApprovedFollower: true
      })
    ).toBe(true);
  });

  test('private post is author-only even on private accounts', () => {
    expect(
      canViewerReadPost({
        viewerUid: 'f',
        viewerIsAdmin: false,
        authorUid: 'a',
        authorIsPrivateAccount: true,
        postVisibility: 'private',
        viewerIsApprovedFollower: true
      })
    ).toBe(false);
  });
});
