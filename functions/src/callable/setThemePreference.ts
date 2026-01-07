import { onCall } from 'firebase-functions/v2/https';
import { db } from '../init';
import { requireAuth } from '../utils/auth';
import { requireUserActive } from '../utils/users';
import { nowIso } from '../utils/firestore';
import { validateOrThrow } from '../utils/validation';
import { setThemePreferenceSchema } from '../schemas/requests';

type ThemeType = 'noir' | 'analog' | 'luma' | 'flux';
type Req = { theme: ThemeType };
type Res = { ok: true; theme: ThemeType };

export const setThemePreference = onCall({ region: 'us-central1' }, async (req): Promise<Res> => {
  const { uid } = requireAuth(req);
  await requireUserActive(uid);

  const data = validateOrThrow<Req>(setThemePreferenceSchema, req.data);
  const now = nowIso();

  await db().collection('users').doc(uid).set({ theme: data.theme, updatedAt: now }, { merge: true });

  return { ok: true, theme: data.theme };
});
