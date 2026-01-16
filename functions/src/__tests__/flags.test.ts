import { parseBooleanFlag } from '../utils/flags';

describe('flags', () => {
  test('parseBooleanFlag returns default for empty', () => {
    expect(parseBooleanFlag(undefined, false)).toBe(false);
    expect(parseBooleanFlag(null, true)).toBe(true);
    expect(parseBooleanFlag('', true)).toBe(true);
    expect(parseBooleanFlag('   ', false)).toBe(false);
  });

  test('parseBooleanFlag parses truthy values', () => {
    for (const v of ['true', 'TRUE', '1', 'yes', 'Y', 'on', ' On ']) {
      expect(parseBooleanFlag(v, false)).toBe(true);
    }
  });

  test('parseBooleanFlag parses falsy values', () => {
    for (const v of ['false', 'FALSE', '0', 'no', 'N', 'off', ' Off ']) {
      expect(parseBooleanFlag(v, true)).toBe(false);
    }
  });

  test('parseBooleanFlag returns default for unknown values', () => {
    expect(parseBooleanFlag('maybe', false)).toBe(false);
    expect(parseBooleanFlag('maybe', true)).toBe(true);
  });
});

