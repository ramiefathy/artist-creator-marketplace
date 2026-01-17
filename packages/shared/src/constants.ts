export const PLATFORM_FEE_BPS = 2000 as const; // 20%
export const CURRENCY = 'USD' as const;

export const CONTRACT_AUTO_CANCEL_HOURS = 24 as const;
export const DELIVERABLE_AUTO_APPROVE_HOURS = 72 as const;
export const POST_MUST_REMAIN_LIVE_DAYS = 30 as const;

export const MIN_PRICE_CENTS = 500 as const;
export const MAX_PRICE_CENTS = 500000 as const;

// Stripe API version must be pinned.
export const STRIPE_API_VERSION = '2025-12-15.clover' as const;

export const GENRES = [
  'pop','hiphop','rap','rnb','edm','house','techno','drumandbass','rock','indie','alternative','metal',
  'punk','latin','reggaeton','afrobeats','kpop','country','jazz','classical','singer_songwriter','folk',
  'instrumental','other'
] as const;

export type Genre = typeof GENRES[number];

export const CAMPAIGN_PLATFORMS = ['tiktok','instagram','youtube'] as const;
export type CampaignPlatform = typeof CAMPAIGN_PLATFORMS[number];

export const DELIVERABLE_TYPES = ['tiktok_post','ig_reel','yt_short'] as const;
export type DeliverableType = typeof DELIVERABLE_TYPES[number];

export const USER_ROLES = ['unassigned','artist','creator','admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const USER_STATUSES = ['active','suspended'] as const;
export type UserStatus = typeof USER_STATUSES[number];

export const CREATOR_VERIFICATION_STATUSES = ['unverified','pending','verified','rejected'] as const;
export type CreatorVerificationStatus = typeof CREATOR_VERIFICATION_STATUSES[number];

export const CAMPAIGN_STATUSES = ['draft','live','paused','completed','archived'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

export const OFFER_STATUSES = ['submitted','withdrawn','accepted','rejected'] as const;
export type OfferStatus = typeof OFFER_STATUSES[number];

export const CONTRACT_STATUSES = ['pending_payment','active','completed','cancelled','disputed'] as const;
export type ContractStatus = typeof CONTRACT_STATUSES[number];

export const STRIPE_PAYMENT_STATUSES = ['unpaid','paid','refunded','partial_refund','failed'] as const;
export type StripePaymentStatus = typeof STRIPE_PAYMENT_STATUSES[number];

export const DELIVERABLE_STATUSES = ['pending','submitted','revision_requested','approved','rejected','expired'] as const;
export type DeliverableStatus = typeof DELIVERABLE_STATUSES[number];

export const DISPUTE_REASON_CODES = [
  'non_delivery','wrong_music','missing_disclosure','late_post','quality_issue','other'
] as const;
export type DisputeReasonCode = typeof DISPUTE_REASON_CODES[number];

export const DISPUTE_STATUSES = [
  'open','under_review','resolved_refund','resolved_no_refund','resolved_partial_refund'
] as const;
export type DisputeStatus = typeof DISPUTE_STATUSES[number];

export const NOTIFICATION_TYPES = [
  'offer_submitted','offer_accepted','offer_rejected','payment_received',
  'message','contract_cancelled',
  'deliverable_submitted','deliverable_approved','deliverable_revision','deliverable_rejected',
  'dispute_opened','dispute_resolved','payout_sent',
  'verification_requested','verification_decision',
  'admin_message',
  'social_follow_requested',
  'social_follow_approved',
  'social_followed',
  'social_comment',
  'social_like'
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const DISCLOSURE_TEXT_DEFAULT = 'Paid partnership with @ARTIST_HANDLE — #ad' as const;

export const LICENSE_GRANT_TEXT_V1 = [
  'Artist grants Creator a non-exclusive, non-transferable, worldwide, royalty-free license to use the Track solely to create and publish the Deliverable(s) specified in this Contract on the Approved Platform(s).',
  'This license includes the right to synchronize the Track with Creator’s original audiovisual content for the Deliverable(s) and to publicly perform and display the Deliverable(s) on the Approved Platform(s).',
  'Creator may not distribute the Track standalone, register the Track as their own, or authorize third parties to use the Track outside this Contract.',
  'Creator must comply with all platform music policies and applicable law.',
  'This license begins upon Contract activation and continues for as long as the Deliverable remains published on the Approved Platform(s), provided Creator complies with the Contract.'
].join(' ');

export const DISCLOSURE_REQUIREMENTS_TEXT_V1 = [
  'Creator must clearly and conspicuously disclose the paid relationship with Artist in the Deliverable, using platform-provided disclosure tools where available and including a disclosure in the caption or on-screen text (e.g., “Paid partnership” and/or “#ad”).',
  'Failure to include disclosure is a material breach.'
].join(' ');
