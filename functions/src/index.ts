export { authOnCreateUser } from './triggers/authOnCreateUser';

export { setInitialRole } from './callable/setInitialRole';
export { setThemePreference } from './callable/setThemePreference';
export { updateArtistProfile, updateCreatorProfile } from './callable/profiles';
export { requestCreatorVerification, adminSetCreatorVerification } from './callable/creatorVerification';

export { creatorStartStripeOnboarding, creatorRefreshStripeOnboarding, creatorSyncStripeOnboardingStatus } from './callable/stripeConnect';

export { createTrack, registerTrackRightsDocument } from './callable/tracks';
export { createCampaign, publishCampaign, updateCampaignStatus, updateCampaign } from './callable/campaigns';

export { submitOffer, withdrawOffer, acceptOffer, rejectOffer } from './callable/offers';

export { submitDeliverable, artistApproveDeliverable, artistRequestRevision, artistRejectDeliverable } from './callable/deliverables';

export { openDispute, adminResolveDispute } from './callable/disputes';

export { sendMessage } from './callable/messaging';
export { leaveReview } from './callable/reviews';
export {
  setAccountPrivacy,
  requestFollow,
  claimHandle,
  approveFollower,
  removeFollower,
  unfollow,
  createPost,
  updatePost,
  deletePost,
  createComment,
  deleteComment,
  toggleLike
} from './callable/social';
export { initiateMediaUpload, finalizeMediaUpload, attachMediaToPost } from './callable/media';
export { reportPost, reportComment, reportUser, adminUpdateReportStatus } from './callable/reports';
export { blockUser, unblockUser, muteUser, unmuteUser } from './callable/blocks';

export {
  getTrackPreviewUrl,
  getContractPdfUrl,
  getDeliverableEvidenceUrls,
  getDisputeEvidenceUrls,
  markNotificationRead,
  adminGetCreatorEvidenceUrls
} from './callable/accessUrls';

export { adminSetUserStatus, adminChangeUserRole } from './callable/admin';

export { stripeWebhook } from './webhooks/stripeWebhook';
export { mediaProxy } from './webhooks/mediaProxy';

export { cancelUnpaidContracts } from './scheduled/cancelUnpaidContracts';
export { autoApproveDeliverables } from './scheduled/autoApproveDeliverables';
export { expireOverdueDeliverables } from './scheduled/expireOverdueDeliverables';
