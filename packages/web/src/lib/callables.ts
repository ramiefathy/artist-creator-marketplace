import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export const callSetInitialRole = httpsCallable(functions, 'setInitialRole');
export const callSetThemePreference = httpsCallable(functions, 'setThemePreference');
export const callUpdateArtistProfile = httpsCallable(functions, 'updateArtistProfile');
export const callUpdateCreatorProfile = httpsCallable(functions, 'updateCreatorProfile');

export const callRequestCreatorVerification = httpsCallable(functions, 'requestCreatorVerification');
export const callAdminSetCreatorVerification = httpsCallable(functions, 'adminSetCreatorVerification');

export const callCreatorStartStripeOnboarding = httpsCallable(functions, 'creatorStartStripeOnboarding');
export const callCreatorRefreshStripeOnboarding = httpsCallable(functions, 'creatorRefreshStripeOnboarding');
export const callCreatorSyncStripeOnboardingStatus = httpsCallable(functions, 'creatorSyncStripeOnboardingStatus');

export const callCreateTrack = httpsCallable(functions, 'createTrack');
export const callRegisterTrackRightsDocument = httpsCallable(functions, 'registerTrackRightsDocument');

export const callCreateCampaign = httpsCallable(functions, 'createCampaign');
export const callPublishCampaign = httpsCallable(functions, 'publishCampaign');
export const callSetCampaignPublicVisibility = httpsCallable(functions, 'setCampaignPublicVisibility');
export const callUpdateCampaign = httpsCallable(functions, 'updateCampaign');
export const callUpdateCampaignStatus = httpsCallable(functions, 'updateCampaignStatus');

export const callSubmitOffer = httpsCallable(functions, 'submitOffer');
export const callWithdrawOffer = httpsCallable(functions, 'withdrawOffer');
export const callAcceptOffer = httpsCallable(functions, 'acceptOffer');
export const callRejectOffer = httpsCallable(functions, 'rejectOffer');

export const callSubmitDeliverable = httpsCallable(functions, 'submitDeliverable');
export const callArtistApproveDeliverable = httpsCallable(functions, 'artistApproveDeliverable');
export const callArtistRequestRevision = httpsCallable(functions, 'artistRequestRevision');
export const callArtistRejectDeliverable = httpsCallable(functions, 'artistRejectDeliverable');

export const callOpenDispute = httpsCallable(functions, 'openDispute');
export const callAdminResolveDispute = httpsCallable(functions, 'adminResolveDispute');

export const callSendMessage = httpsCallable(functions, 'sendMessage');
export const callLeaveReview = httpsCallable(functions, 'leaveReview');

export const callGetTrackPreviewUrl = httpsCallable(functions, 'getTrackPreviewUrl');
export const callGetContractPdfUrl = httpsCallable(functions, 'getContractPdfUrl');
export const callGetDeliverableEvidenceUrls = httpsCallable(functions, 'getDeliverableEvidenceUrls');
export const callGetDisputeEvidenceUrls = httpsCallable(functions, 'getDisputeEvidenceUrls');
export const callMarkNotificationRead = httpsCallable(functions, 'markNotificationRead');

export const callAdminSetUserStatus = httpsCallable(functions, 'adminSetUserStatus');
export const callAdminChangeUserRole = httpsCallable(functions, 'adminChangeUserRole');

export const callAdminGetCreatorEvidenceUrls = httpsCallable(functions, 'adminGetCreatorEvidenceUrls');

// Social
export const callSetAccountPrivacy = httpsCallable(functions, 'setAccountPrivacy');
export const callRequestFollow = httpsCallable(functions, 'requestFollow');
export const callApproveFollower = httpsCallable(functions, 'approveFollower');
export const callRemoveFollower = httpsCallable(functions, 'removeFollower');
export const callUnfollow = httpsCallable(functions, 'unfollow');
export const callClaimHandle = httpsCallable(functions, 'claimHandle');
export const callCreatePost = httpsCallable(functions, 'createPost');
export const callUpdatePost = httpsCallable(functions, 'updatePost');
export const callDeletePost = httpsCallable(functions, 'deletePost');
export const callCreateComment = httpsCallable(functions, 'createComment');
export const callDeleteComment = httpsCallable(functions, 'deleteComment');
export const callToggleLike = httpsCallable(functions, 'toggleLike');

// Social media
export const callInitiateMediaUpload = httpsCallable(functions, 'initiateMediaUpload');
export const callFinalizeMediaUpload = httpsCallable(functions, 'finalizeMediaUpload');
export const callAttachMediaToPost = httpsCallable(functions, 'attachMediaToPost');

// Reports / moderation
export const callReportPost = httpsCallable(functions, 'reportPost');
export const callReportComment = httpsCallable(functions, 'reportComment');
export const callReportUser = httpsCallable(functions, 'reportUser');
export const callAdminUpdateReportStatus = httpsCallable(functions, 'adminUpdateReportStatus');

// Safety controls
export const callBlockUser = httpsCallable(functions, 'blockUser');
export const callUnblockUser = httpsCallable(functions, 'unblockUser');
export const callMuteUser = httpsCallable(functions, 'muteUser');
export const callUnmuteUser = httpsCallable(functions, 'unmuteUser');
