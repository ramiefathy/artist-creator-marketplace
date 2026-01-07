import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export const callSetInitialRole = httpsCallable(functions, 'setInitialRole');
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
