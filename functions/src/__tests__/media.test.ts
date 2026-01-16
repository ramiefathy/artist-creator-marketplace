import { assertDeclaredUploadOk, assertUploadPathMatches, isAllowedMimeType, maxBytesForKind, normalizeFilename } from '../utils/media';

describe('media', () => {
  test('normalizeFilename strips paths and unsafe chars', () => {
    expect(normalizeFilename('..\\evil.exe')).toBe('evil.exe');
    expect(normalizeFilename(' My Video (Final).MP4 ')).toBe('my_video_final_.mp4');
  });

  test('maxBytesForKind has sane ordering', () => {
    expect(maxBytesForKind('image')).toBeLessThan(maxBytesForKind('audio'));
    expect(maxBytesForKind('audio')).toBeLessThanOrEqual(maxBytesForKind('video'));
  });

  test('isAllowedMimeType whitelists expected types', () => {
    expect(isAllowedMimeType('image', 'image/jpeg')).toBe(true);
    expect(isAllowedMimeType('image', 'image/gif')).toBe(false);
    expect(isAllowedMimeType('audio', 'audio/mpeg')).toBe(true);
    expect(isAllowedMimeType('audio', 'video/mp4')).toBe(false);
    expect(isAllowedMimeType('video', 'video/mp4')).toBe(true);
    expect(isAllowedMimeType('video', 'application/octet-stream')).toBe(false);
  });

  test('assertDeclaredUploadOk throws on invalid size/mime', () => {
    expect(() => assertDeclaredUploadOk({ kind: 'image', mimeType: 'image/gif', sizeBytes: 10 })).toThrow();
    expect(() => assertDeclaredUploadOk({ kind: 'image', mimeType: 'image/png', sizeBytes: 0 })).toThrow();
    expect(() => assertDeclaredUploadOk({ kind: 'image', mimeType: 'image/png', sizeBytes: 999999999 })).toThrow();
  });

  test('assertUploadPathMatches throws when path mismatches', () => {
    expect(() =>
      assertUploadPathMatches({
        uid: 'u1',
        uploadId: 'up1',
        filename: 'file.png',
        storagePath: 'socialUploads/u1/up1/file.png'
      })
    ).not.toThrow();

    expect(() =>
      assertUploadPathMatches({
        uid: 'u1',
        uploadId: 'up1',
        filename: 'file.png',
        storagePath: 'socialUploads/u1/other/file.png'
      })
    ).toThrow();
  });
});
