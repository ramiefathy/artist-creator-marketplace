export const PLATFORM_FEE_BPS = 2000 as const; // 20%
export const STRIPE_API_VERSION = '2025-12-15.clover' as const;

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

export const POST_MUST_REMAIN_LIVE_DAYS = 30 as const;
export const CONTRACT_AUTO_CANCEL_HOURS = 24 as const;
export const DELIVERABLE_AUTO_APPROVE_HOURS = 72 as const;
