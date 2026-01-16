import { canViewerReadPost, type PostVisibility } from './socialVisibility';

export function canViewerReadAsset(params: {
  viewerUid: string | null;
  viewerIsAdmin: boolean;
  viewerIsApprovedFollower: boolean;
  authorUid: string;
  authorIsPrivateAccount: boolean;
  postVisibility: PostVisibility;
}): boolean {
  return canViewerReadPost({
    viewerUid: params.viewerUid,
    viewerIsAdmin: params.viewerIsAdmin,
    authorUid: params.authorUid,
    authorIsPrivateAccount: params.authorIsPrivateAccount,
    postVisibility: params.postVisibility,
    viewerIsApprovedFollower: params.viewerIsApprovedFollower
  });
}

