import { bucket } from '../init';

export async function getSignedReadUrl(storagePath: string, expiresMinutes: number): Promise<string> {
  const file = bucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Storage object missing: ${storagePath}`);
  }
  const expires = Date.now() + expiresMinutes * 60 * 1000;
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires
  });
  return url;
}
