const REGION = 'us-central1';

export function getFunctionUrl(functionName: string): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID');

  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
    return `http://localhost:5001/${projectId}/${REGION}/${functionName}`;
  }

  return `https://${REGION}-${projectId}.cloudfunctions.net/${functionName}`;
}

export function getMediaProxyUrl(assetId: string): string {
  const base = getFunctionUrl('mediaProxy');
  return `${base}?assetId=${encodeURIComponent(assetId)}`;
}

