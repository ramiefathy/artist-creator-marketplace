import { err } from './errors';

export type MediaKind = 'image' | 'video' | 'audio';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export function maxBytesForKind(kind: MediaKind): number {
  if (kind === 'image') return MAX_IMAGE_BYTES;
  if (kind === 'audio') return MAX_AUDIO_BYTES;
  return MAX_VIDEO_BYTES;
}

export function isAllowedMimeType(kind: MediaKind, mimeType: string): boolean {
  const mt = mimeType.toLowerCase();
  if (kind === 'image') return mt === 'image/jpeg' || mt === 'image/png' || mt === 'image/webp';
  if (kind === 'audio') return mt === 'audio/mpeg' || mt === 'audio/mp3' || mt === 'audio/wav' || mt === 'audio/x-wav' || mt === 'audio/mp4';
  // video
  return mt === 'video/mp4' || mt === 'video/quicktime' || mt === 'video/webm';
}

export function normalizeFilename(input: string): string {
  const raw = input.trim().replace(/\\/g, '/');
  const last = raw.split('/').pop() || 'file';
  const safe = last
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return safe || 'file';
}

export function assertDeclaredUploadOk(params: { kind: MediaKind; mimeType: string; sizeBytes: number }): void {
  if (!isAllowedMimeType(params.kind, params.mimeType)) err('INVALID_ARGUMENT', 'UNSUPPORTED_MIME_TYPE');
  const max = maxBytesForKind(params.kind);
  if (!Number.isFinite(params.sizeBytes) || params.sizeBytes <= 0) err('INVALID_ARGUMENT', 'INVALID_SIZE');
  if (params.sizeBytes > max) err('INVALID_ARGUMENT', 'FILE_TOO_LARGE');
}

export function assertUploadPathMatches(params: { uid: string; uploadId: string; filename: string; storagePath: string }): void {
  const expected = `socialUploads/${params.uid}/${params.uploadId}/${params.filename}`;
  if (params.storagePath !== expected) err('FAILED_PRECONDITION', 'UPLOAD_PATH_MISMATCH');
}

