const RESERVED_HANDLES = new Set<string>([
  'admin',
  'api',
  'assets',
  'auth',
  'billing',
  'blog',
  'campaigns',
  'careers',
  'cdn',
  'dashboard',
  'discover',
  'explore',
  'feed',
  'help',
  'home',
  'legal',
  'login',
  'logout',
  'messages',
  'notifications',
  'onboarding',
  'p',
  'privacy',
  'profile',
  'robots',
  'signup',
  'support',
  'terms',
  'u',
  'user',
  'users'
]);

export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidHandle(input: string): boolean {
  const handle = normalizeHandle(input);
  if (handle.length < 3 || handle.length > 24) return false;
  if (!/^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$/.test(handle)) return false;
  if (RESERVED_HANDLES.has(handle)) return false;
  return true;
}

export function slugifyToHandleBase(input: string): string {
  const s = normalizeHandle(input)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  // Ensure base starts with alnum (and is non-empty)
  const base = s.replace(/^[^a-z0-9]+/, '');
  return base || 'user';
}

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const ADJECTIVES = [
  'amber',
  'bold',
  'bright',
  'calm',
  'crisp',
  'electric',
  'gentle',
  'golden',
  'lunar',
  'mellow',
  'midnight',
  'modern',
  'neon',
  'novel',
  'quiet',
  'rapid',
  'silver',
  'steady',
  'sunny',
  'vivid'
] as const;

const NOUNS = [
  'echo',
  'groove',
  'harmony',
  'hook',
  'loop',
  'melody',
  'mixer',
  'pulse',
  'rhythm',
  'sample',
  'signal',
  'synth',
  'tempo',
  'track',
  'vibe',
  'wave'
] as const;

/**
 * Suggest a stable guest handle tied to uid (deterministic), with fallbacks.
 * The caller should try these in order and pick the first available.
 */
export function suggestGuestHandlesForUid(uid: string): string[] {
  const h = fnv1a32(uid);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(Math.floor(h / 97) >>> 0) % NOUNS.length];
  const digits = String(h % 10000).padStart(4, '0');

  const base = `guest_${adj}_${noun}_${digits}`;
  const alt1 = `guest_${adj}_${noun}_${uid.slice(0, 4).toLowerCase()}`;
  const alt2 = `guest_${noun}_${uid.slice(0, 8).toLowerCase()}`;

  return [base, alt1, alt2].filter(isValidHandle);
}

export function suggestHandleCandidates(params: { uid: string; displayNameOrEmail: string | null; preferGuest: boolean }): string[] {
  if (params.preferGuest) return suggestGuestHandlesForUid(params.uid);

  const base = slugifyToHandleBase(params.displayNameOrEmail ?? 'user');
  const candidates = [base, `${base}_2`, `${base}_3`, `${base}_${params.uid.slice(0, 4).toLowerCase()}`];
  return candidates.filter(isValidHandle);
}

