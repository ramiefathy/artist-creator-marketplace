import type {
  CampaignPlatform, DeliverableType, Genre, UserRole, UserStatus,
  CreatorVerificationStatus, CampaignStatus, OfferStatus, ContractStatus,
  StripePaymentStatus, DeliverableStatus, DisputeReasonCode, DisputeStatus,
  NotificationType
} from './constants';

export type IsoDateTime = string; // RFC3339 UTC

export interface UserDoc {
  uid: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  theme?: 'noir' | 'analog' | 'luma' | 'flux';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ArtistProfileDoc {
  uid: string;
  displayName: string;
  entityType: 'individual' | 'label' | 'management';
  country: string;
  timezone: string;
  ratingAvg: number;
  ratingCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ArtistPrivateDoc {
  uid: string;
  stripeCustomerId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreatorProfileDoc {
  uid: string;
  displayName: string;
  bio: string | null;
  niches: string[];
  platformHandles: {
    tiktok: string | null;
    instagram: string | null;
    youtube: string | null;
  };
  audienceCountries: string[];
  metricsSelfReported: {
    tiktokFollowers: number;
    tiktokAvgViews: number;
    instagramFollowers: number;
    instagramAvgViews: number;
    youtubeSubscribers: number;
    youtubeAvgViews: number;
  };
  verificationStatus: CreatorVerificationStatus;
  ratingAvg: number;
  ratingCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreatorPrivateDoc {
  uid: string;
  metricsEvidencePaths: string[];
  verificationNotes: string | null;
  verificationRequestedAt: IsoDateTime | null;
  verificationReviewedAt: IsoDateTime | null;
  verificationReviewedBy: string | null;
  stripeConnect: {
    accountId: string | null;
    onboardingStatus: 'not_started' | 'pending' | 'complete';
  };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TrackDoc {
  trackId: string;
  ownerUid: string;
  title: string;
  artistName: string;
  genre: Genre;
  moodTags: string[];
  isrc: string | null;
  coverArtPath: string | null;
  externalLinks: {
    spotify: string | null;
    appleMusic: string | null;
    youtube: string | null;
    tiktokSound: string | null;
  };
  rightsTier: 'tier1_attestation' | 'tier2_verified';
  rightsAttestation: {
    attestsMasterRights: boolean;
    attestsPublishingRights: boolean;
    hasCoWritersOrSplits: boolean;
    acceptedAt: IsoDateTime;
  };
  rightsReview: {
    status: 'not_required' | 'pending' | 'approved' | 'rejected';
    reviewedBy: string | null;
    reviewedAt: IsoDateTime | null;
  };
  status: 'active' | 'archived';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TrackPrivateDoc {
  trackId: string;
  ownerUid: string;
  previewAudioPath: string;
  rightsDocumentsPaths: string[];
  rightsAttestationNotes: string | null;
  rightsReviewNotes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CampaignDoc {
  campaignId: string;
  ownerUid: string;
  trackId: string;
  title: string;
  brief: string;
  platforms: CampaignPlatform[];
  deliverableSpec: {
    deliverablesTotal: number;
    deliverableType: DeliverableType;
    postMustRemainLiveDays: number;
    dueDaysAfterActivation: number;
  };
  contentGuidelines: {
    mustIncludeDisclosure: true;
    disclosureTextExample: string;
    hashtags: string[];
    callToAction: string | null;
    doNotInclude: string | null;
  };
  pricing: {
    currency: 'USD';
    maxPricePerDeliverableCents: number;
  };
  status: CampaignStatus;
  acceptedDeliverablesCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OfferDoc {
  offerId: string;
  campaignId: string;
  creatorUid: string;
  artistUid: string;
  deliverablesCount: 1;
  priceCents: number;
  message: string | null;
  status: OfferStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ContractDoc {
  contractId: string;
  campaignId: string;
  trackId: string;
  artistUid: string;
  creatorUid: string;
  offerId: string;

  status: ContractStatus;

  pricing: {
    currency: 'USD';
    totalPriceCents: number;
    platformFeeBps: number;
    creatorPayoutTotalCents: number;
  };

  payout: {
    creatorStripeAccountId: string;
    paidOutCents: number;
    stripeTransferId: string | null;
    transferStatus: 'none' | 'pending' | 'sent' | 'failed';
  };

  stripe: {
    checkoutSessionId: string;
    paymentIntentId: string | null;
    paymentStatus: StripePaymentStatus;
  };

  terms: {
    termsVersion: 'v1';
    licenseGrantText: string;
    disclosureRequirementsText: string;
    agreedByCreatorAt: IsoDateTime | null;
    agreedByArtistAt: IsoDateTime | null;
  };

  snapshots: Record<string, any>;

  contractPdfPath: string;
  activatedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DeliverableDoc {
  deliverableId: string;
  contractId: string;
  campaignId: string;
  artistUid: string;
  creatorUid: string;
  type: DeliverableType;
  dueAt: IsoDateTime;
  status: DeliverableStatus;

  submission: {
    postUrl: string | null;
    submittedAt: IsoDateTime | null;
    creatorNotes: string | null;
    compliance: {
      disclosureConfirmed: boolean;
      licenseConfirmed: boolean;
      postLiveDaysConfirmed: boolean;
    } | null;
    evidencePaths: string[];
    metrics24h: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    } | null;
  };

  review: {
    artistDecision: 'none' | 'approved' | 'revision_requested' | 'rejected';
    artistNotes: string | null;
    reviewedAt: IsoDateTime | null;
  };

  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ThreadDoc {
  threadId: string;
  participants: [string, string];
  campaignId: string;
  offerId: string | null;
  contractId: string | null;
  lastMessageAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface MessageDoc {
  messageId: string;
  senderUid: string;
  text: string;
  createdAt: IsoDateTime;
}

export interface NotificationDoc {
  notificationId: string;
  toUid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: IsoDateTime;
}

export interface DisputeDoc {
  disputeId: string;
  contractId: string;
  artistUid: string;
  creatorUid: string;
  openedByUid: string;
  openedByRole: 'artist' | 'creator' | 'admin';
  reasonCode: DisputeReasonCode;
  description: string;
  evidencePaths: string[];
  status: DisputeStatus;
  resolution: {
    adminUid: string | null;
    notes: string | null;
    refundCents: number;
    resolvedAt: IsoDateTime | null;
  };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ReviewDoc {
  reviewId: string;
  contractId: string;
  fromUid: string;
  toUid: string;
  fromRole: 'artist' | 'creator';
  rating: 1 | 2 | 3 | 4 | 5;
  text: string | null;
  createdAt: IsoDateTime;
}

export interface AuditLogDoc {
  logId: string;
  actorUid: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTime;
}

export interface StripeEventDoc {
  eventId: string;
  type: string;
  processedAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface PayoutTransferDoc {
  id: string;
  contractId: string;
  artistUid: string;
  creatorUid: string;
  stripeTransferId: string;
  amountCents: number;
  currency: 'USD';
  status: 'sent' | 'failed';
  createdAt: IsoDateTime;
}
