export type PostVisibility = 'public' | 'followers' | 'private';

export function canViewerReadPost(params: {
  viewerUid: string | null;
  viewerIsAdmin: boolean;
  authorUid: string;
  authorIsPrivateAccount: boolean;
  postVisibility: PostVisibility;
  viewerIsApprovedFollower: boolean;
}): boolean {
  if (params.viewerIsAdmin) return true;
  if (params.viewerUid && params.viewerUid === params.authorUid) return true;

  // Per-post privacy is always strict (author/admin only), even if the account is private.
  if (params.postVisibility === 'private') return false;

  // Account privacy acts as an upper bound: public posts become follower-only for private accounts.
  if (params.authorIsPrivateAccount) return params.viewerUid != null && params.viewerIsApprovedFollower;

  if (params.postVisibility === 'public') return true;
  if (params.postVisibility === 'followers') return params.viewerUid != null && params.viewerIsApprovedFollower;
  return false;
}
