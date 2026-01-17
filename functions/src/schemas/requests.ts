// Request validation schemas for callable functions.
// These are JSON Schema Draft 2020-12 compatible objects used by AJV in utils/validation.ts.

export const setInitialRoleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['role'],
  properties: {
    role: { type: 'string', enum: ['artist', 'creator'] }
  }
} as const;

export const setThemePreferenceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['theme'],
  properties: {
    theme: { type: 'string', enum: ['studio', 'liner'] }
  }
} as const;

export const updateArtistProfileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['displayName', 'entityType', 'country', 'timezone'],
  properties: {
    displayName: { type: 'string', minLength: 3, maxLength: 60 },
    entityType: { type: 'string', enum: ['individual', 'label', 'management'] },
    country: { type: 'string', pattern: '^[A-Z]{2}$' },
    timezone: { type: 'string', minLength: 3, maxLength: 64 }
  }
} as const;

export const updateCreatorProfileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['displayName', 'bio', 'niches', 'platformHandles', 'audienceCountries', 'metricsSelfReported'],
  properties: {
    displayName: { type: 'string', minLength: 3, maxLength: 60 },
    bio: { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }] },
    niches: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', minLength: 2, maxLength: 32 } },
    platformHandles: {
      type: 'object',
      additionalProperties: false,
      required: ['tiktok', 'instagram', 'youtube'],
      properties: {
        tiktok: { anyOf: [{ type: 'string', maxLength: 64 }, { type: 'null' }] },
        instagram: { anyOf: [{ type: 'string', maxLength: 64 }, { type: 'null' }] },
        youtube: { anyOf: [{ type: 'string', maxLength: 128 }, { type: 'null' }] }
      }
    },
    audienceCountries: { type: 'array', maxItems: 10, items: { type: 'string', pattern: '^[A-Z]{2}$' } },
    metricsSelfReported: {
      type: 'object',
      additionalProperties: false,
      required: [
        'tiktokFollowers',
        'tiktokAvgViews',
        'instagramFollowers',
        'instagramAvgViews',
        'youtubeSubscribers',
        'youtubeAvgViews'
      ],
      properties: {
        tiktokFollowers: { type: 'integer', minimum: 0 },
        tiktokAvgViews: { type: 'integer', minimum: 0 },
        instagramFollowers: { type: 'integer', minimum: 0 },
        instagramAvgViews: { type: 'integer', minimum: 0 },
        youtubeSubscribers: { type: 'integer', minimum: 0 },
        youtubeAvgViews: { type: 'integer', minimum: 0 }
      }
    }
  }
} as const;

export const emptyObjectSchema = {
  type: 'object',
  additionalProperties: false
} as const;


export const requestCreatorVerificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['evidencePaths', 'notes'],
  properties: {
    evidencePaths: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: { type: 'string', minLength: 3, maxLength: 200 }
    },
    notes: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] }
  }
} as const;


export const adminSetCreatorVerificationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['creatorUid', 'status'],
  properties: {
    creatorUid: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['verified', 'rejected'] },
    notes: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] }
  }
} as const;

export const createTrackSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'trackId',
    'title',
    'artistName',
    'genre',
    'moodTags',
    'isrc',
    'externalLinks',
    'rightsTier',
    'rightsAttestation',
    'rightsAttestationNotes',
    'coverUploaded'
  ],
  properties: {
    trackId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1, maxLength: 120 },
    artistName: { type: 'string', minLength: 1, maxLength: 120 },
    genre: { type: 'string', minLength: 1 },
    moodTags: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 32 } },
    isrc: { anyOf: [{ type: 'string', pattern: '^[A-Z]{2}[A-Z0-9]{3}\\d{7}$' }, { type: 'null' }] },
    externalLinks: {
      type: 'object',
      additionalProperties: false,
      required: ['spotify', 'appleMusic', 'youtube', 'tiktokSound'],
      properties: {
        spotify: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
        appleMusic: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
        youtube: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
        tiktokSound: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] }
      }
    },
    rightsTier: { type: 'string', enum: ['tier1_attestation', 'tier2_verified'] },
    rightsAttestation: {
      type: 'object',
      additionalProperties: false,
      required: ['attestsMasterRights', 'attestsPublishingRights', 'hasCoWritersOrSplits'],
      properties: {
        attestsMasterRights: { type: 'boolean' },
        attestsPublishingRights: { type: 'boolean' },
        hasCoWritersOrSplits: { type: 'boolean' }
      }
    },
    rightsAttestationNotes: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] },
    coverUploaded: { type: 'boolean' }
  }
} as const;

export const registerTrackRightsDocSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['trackId', 'storagePath'],
  properties: {
    trackId: { type: 'string', minLength: 1 },
    storagePath: { type: 'string', minLength: 1 }
  }
} as const;

export const createCampaignSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['trackId', 'title', 'brief', 'platforms', 'deliverableSpec', 'contentGuidelines', 'pricing'],
  properties: {
    trackId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 5, maxLength: 120 },
    brief: { type: 'string', minLength: 50, maxLength: 4000 },
    platforms: { type: 'array', minItems: 1, maxItems: 3, uniqueItems: true, items: { type: 'string', enum: ['tiktok','instagram','youtube'] } },
    deliverableSpec: {
      type: 'object',
      additionalProperties: false,
      required: ['deliverablesTotal', 'deliverableType', 'dueDaysAfterActivation'],
      properties: {
        deliverablesTotal: { type: 'integer', minimum: 1, maximum: 50 },
        deliverableType: { type: 'string', enum: ['tiktok_post','ig_reel','yt_short'] },
        dueDaysAfterActivation: { type: 'integer', minimum: 1, maximum: 30 }
      }
    },
    contentGuidelines: {
      type: 'object',
      additionalProperties: false,
      required: ['disclosureTextExample', 'hashtags', 'callToAction', 'doNotInclude'],
      properties: {
        disclosureTextExample: { type: 'string', minLength: 1, maxLength: 200 },
        hashtags: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 64 } },
        callToAction: { anyOf: [{ type: 'string', maxLength: 200 }, { type: 'null' }] },
        doNotInclude: { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }] }
      }
    },
    pricing: {
      type: 'object',
      additionalProperties: false,
      required: ['maxPricePerDeliverableCents'],
      properties: {
        maxPricePerDeliverableCents: { type: 'integer', minimum: 500, maximum: 500000 }
      }
    }
  }
} as const;

export const publishCampaignSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['campaignId'],
  properties: { campaignId: { type: 'string', minLength: 1 } }
} as const;

export const updateCampaignSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['campaignId', 'patch'],
  properties: {
    campaignId: { type: 'string', minLength: 1 },
    patch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 5, maxLength: 120 },
        brief: { type: 'string', minLength: 50, maxLength: 4000 },
        platforms: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          uniqueItems: true,
          items: { type: 'string', enum: ['tiktok','instagram','youtube'] }
        },
        deliverableSpec: {
          type: 'object',
          additionalProperties: false,
          properties: {
            deliverablesTotal: { type: 'integer', minimum: 1, maximum: 50 },
            deliverableType: { type: 'string', enum: ['tiktok_post','ig_reel','yt_short'] },
            dueDaysAfterActivation: { type: 'integer', minimum: 1, maximum: 30 }
          }
        },
        contentGuidelines: {
          type: 'object',
          additionalProperties: false,
          properties: {
            disclosureTextExample: { type: 'string', minLength: 1, maxLength: 200 },
            hashtags: { type: 'array', maxItems: 10, items: { type: 'string', minLength: 1, maxLength: 64 } },
            callToAction: { anyOf: [{ type: 'string', maxLength: 200 }, { type: 'null' }] },
            doNotInclude: { anyOf: [{ type: 'string', maxLength: 500 }, { type: 'null' }] }
          }
        },
        pricing: {
          type: 'object',
          additionalProperties: false,
          properties: {
            maxPricePerDeliverableCents: { type: 'integer', minimum: 500, maximum: 500000 }
          }
        }
      }
    }
  }
} as const;

export const updateCampaignStatusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['campaignId', 'status'],
  properties: {
    campaignId: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['draft','live','paused','completed','archived'] }
  }
} as const;

export const submitOfferSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['campaignId', 'priceCents', 'message'],
  properties: {
    campaignId: { type: 'string', minLength: 1 },
    priceCents: { type: 'integer', minimum: 500, maximum: 500000 },
    message: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] }
  }
} as const;

export const byIdSchema = (field: string) =>
  ({
    type: 'object',
    additionalProperties: false,
    required: [field],
    properties: {
      [field]: { type: 'string', minLength: 1 }
    }
  }) as const;

export const submitDeliverableSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['deliverableId', 'postUrl', 'creatorNotes', 'compliance', 'metrics24h', 'evidencePaths'],
  properties: {
    deliverableId: { type: 'string', minLength: 1 },
    postUrl: { type: 'string', format: 'uri' },
    creatorNotes: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] },
    compliance: {
      type: 'object',
      additionalProperties: false,
      required: ['disclosureConfirmed', 'licenseConfirmed', 'postLiveDaysConfirmed'],
      properties: {
        disclosureConfirmed: { type: 'boolean', const: true },
        licenseConfirmed: { type: 'boolean', const: true },
        postLiveDaysConfirmed: { type: 'boolean', const: true }
      }
    },
    metrics24h: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['views', 'likes', 'comments', 'shares', 'saves'],
          properties: {
            views: { type: 'integer', minimum: 0 },
            likes: { type: 'integer', minimum: 0 },
            comments: { type: 'integer', minimum: 0 },
            shares: { type: 'integer', minimum: 0 },
            saves: { type: 'integer', minimum: 0 }
          }
        }
      ]
    },
    evidencePaths: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string', minLength: 3, maxLength: 300 }
    }
  }
} as const;

export const artistDecisionSchema = (decision: 'approve' | 'revision' | 'reject') =>
  ({
    type: 'object',
    additionalProperties: false,
    required: ['deliverableId', 'notes'],
    properties: {
      deliverableId: { type: 'string', minLength: 1 },
      notes:
        decision === 'approve'
          ? { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] }
          : { type: 'string', minLength: 1, maxLength: 1000 }
    }
  }) as const;

export const openDisputeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contractId', 'reasonCode', 'description', 'evidencePaths'],
  properties: {
    contractId: { type: 'string', minLength: 1 },
    reasonCode: { type: 'string', enum: ['non_delivery','wrong_music','missing_disclosure','late_post','quality_issue','other'] },
    description: { type: 'string', minLength: 1, maxLength: 2000 },
    evidencePaths: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string', minLength: 3, maxLength: 300 }
    }
  }
} as const;

export const adminResolveDisputeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['disputeId', 'outcome', 'refundCents', 'notes'],
  properties: {
    disputeId: { type: 'string', minLength: 1 },
    outcome: { type: 'string', enum: ['resolved_refund','resolved_no_refund','resolved_partial_refund'] },
    refundCents: { type: 'integer', minimum: 0, maximum: 500000 },
    notes: { type: 'string', minLength: 1, maxLength: 2000 }
  }
} as const;

export const sendMessageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['threadId', 'text'],
  properties: {
    threadId: { type: 'string', minLength: 1 },
    text: { type: 'string', minLength: 1, maxLength: 2000 }
  }
} as const;

export const leaveReviewSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['contractId', 'rating', 'text'],
  properties: {
    contractId: { type: 'string', minLength: 1 },
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    text: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] }
  }
} as const;

export const adminSetUserStatusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['uid', 'status'],
  properties: {
    uid: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['active','suspended'] }
  }
} as const;

export const adminChangeUserRoleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['uid', 'role'],
  properties: {
    uid: { type: 'string', minLength: 1 },
    role: { type: 'string', enum: ['artist','creator','admin'] }
  }
} as const;

// Social / public platform
export const setAccountPrivacySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['isPrivateAccount'],
  properties: {
    isPrivateAccount: { type: 'boolean' }
  }
} as const;

export const requestFollowSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['targetUid'],
  properties: {
    targetUid: { type: 'string', minLength: 1 }
  }
} as const;

export const approveFollowerSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['followerUid'],
  properties: {
    followerUid: { type: 'string', minLength: 1 }
  }
} as const;

export const removeFollowerSchema = approveFollowerSchema;

export const unfollowSchema = requestFollowSchema;

export const createPostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['caption', 'tags', 'visibility'],
  properties: {
    caption: { type: 'string', minLength: 1, maxLength: 2000 },
    tags: { type: 'array', maxItems: 25, items: { type: 'string', minLength: 1, maxLength: 32 } },
    visibility: { type: 'string', enum: ['public', 'followers', 'private'] }
  }
} as const;

export const updatePostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    caption: { type: 'string', minLength: 1, maxLength: 2000 },
    tags: { type: 'array', maxItems: 25, items: { type: 'string', minLength: 1, maxLength: 32 } },
    visibility: { type: 'string', enum: ['public', 'followers', 'private'] }
  }
} as const;

export const deletePostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId'],
  properties: {
    postId: { type: 'string', minLength: 1 }
  }
} as const;

export const createCommentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId', 'body', 'parentCommentId'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    body: { type: 'string', minLength: 1, maxLength: 1000 },
    parentCommentId: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] }
  }
} as const;

export const deleteCommentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId', 'commentId'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    commentId: { type: 'string', minLength: 1 }
  }
} as const;

export const toggleLikeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId', 'like'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    like: { type: 'boolean' }
  }
} as const;

export const claimHandleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['handle'],
  properties: {
    handle: { type: 'string', minLength: 3, maxLength: 24 }
  }
} as const;

export const initiateMediaUploadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'mimeType', 'sizeBytes', 'originalFilename'],
  properties: {
    kind: { type: 'string', enum: ['image', 'video', 'audio'] },
    mimeType: { type: 'string', minLength: 3, maxLength: 100 },
    sizeBytes: { type: 'integer', minimum: 1 },
    originalFilename: { type: 'string', minLength: 1, maxLength: 200 }
  }
} as const;

export const finalizeMediaUploadSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['uploadId'],
  properties: {
    uploadId: { type: 'string', minLength: 1 }
  }
} as const;

export const attachMediaToPostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId', 'assetId'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    assetId: { type: 'string', minLength: 1 }
  }
} as const;

// Moderation / reports
export const reportPostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId', 'reasonCode', 'message'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    reasonCode: { type: 'string', enum: ['spam', 'harassment', 'hate', 'sexual', 'copyright', 'other'] },
    message: { type: 'string', minLength: 1, maxLength: 2000 }
  }
} as const;

export const reportCommentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['postId', 'commentId', 'reasonCode', 'message'],
  properties: {
    postId: { type: 'string', minLength: 1 },
    commentId: { type: 'string', minLength: 1 },
    reasonCode: { type: 'string', enum: ['spam', 'harassment', 'hate', 'sexual', 'copyright', 'other'] },
    message: { type: 'string', minLength: 1, maxLength: 2000 }
  }
} as const;

export const reportUserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['targetUid', 'reasonCode', 'message'],
  properties: {
    targetUid: { type: 'string', minLength: 1 },
    reasonCode: { type: 'string', enum: ['spam', 'harassment', 'hate', 'sexual', 'impersonation', 'other'] },
    message: { type: 'string', minLength: 1, maxLength: 2000 }
  }
} as const;

export const adminUpdateReportStatusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reportId', 'status'],
  properties: {
    reportId: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['open', 'resolved', 'dismissed'] },
    adminNote: { anyOf: [{ type: 'string', minLength: 1, maxLength: 2000 }, { type: 'null' }] }
  }
} as const;

export const blockUserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['targetUid'],
  properties: {
    targetUid: { type: 'string', minLength: 1 }
  }
} as const;

export const unblockUserSchema = blockUserSchema;

export const muteUserSchema = blockUserSchema;

export const unmuteUserSchema = blockUserSchema;
