import { isValidHandle, normalizeHandle, slugifyToHandleBase, suggestGuestHandlesForUid, suggestHandleCandidates } from '../utils/handles';

describe('handles', () => {
  test('normalizeHandle trims and lowercases', () => {
    expect(normalizeHandle('  HeLLo_123  ')).toBe('hello_123');
  });

  test('isValidHandle enforces basic constraints', () => {
    expect(isValidHandle('ab')).toBe(false); // too short
    expect(isValidHandle('a'.repeat(25))).toBe(false); // too long
    expect(isValidHandle('_abc')).toBe(false); // must start alnum
    expect(isValidHandle('abc_')).toBe(false); // must end alnum
    expect(isValidHandle('a-b')).toBe(false); // invalid char
    expect(isValidHandle('admin')).toBe(false); // reserved
    expect(isValidHandle('good_handle_123')).toBe(true);
  });

  test('slugifyToHandleBase produces safe base', () => {
    expect(slugifyToHandleBase('Hello World!')).toBe('hello_world');
    expect(slugifyToHandleBase('___')).toBe('user');
    expect(slugifyToHandleBase('  Beyoncé  ')).toBe('beyonc'); // non-ascii stripped by regex
  });

  test('suggestGuestHandlesForUid is deterministic and valid', () => {
    const a = suggestGuestHandlesForUid('uid_12345');
    const b = suggestGuestHandlesForUid('uid_12345');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    for (const h of a) expect(isValidHandle(h)).toBe(true);
  });

  test('suggestHandleCandidates prefers guest when requested', () => {
    const guest = suggestHandleCandidates({ uid: 'uid_abc', displayNameOrEmail: 'Name', preferGuest: true });
    expect(guest[0]).toMatch(/^guest_/);
  });
});

