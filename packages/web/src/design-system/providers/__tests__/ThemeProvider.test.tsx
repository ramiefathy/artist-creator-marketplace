import React from 'react';
import { act, render, screen } from '@testing-library/react';

import { ThemeProvider, useTheme } from '@/design-system/providers/ThemeProvider';
import { useAuth } from '@/components/AuthProvider';
import { doc, getDoc } from 'firebase/firestore';

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn()
}));

jest.mock('@/lib/firebase', () => ({
  db: {}
}));

jest.mock('@/lib/callables', () => ({
  callSetThemePreference: jest.fn(() => Promise.resolve())
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn()
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function clearThemeCookie() {
  document.cookie = 'mcmp-theme-v2=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

function ThemeReadout() {
  const { theme } = useTheme();
  return <div data-testid="theme">{theme}</div>;
}

describe('ThemeProvider', () => {
  const useAuthMock = useAuth as jest.Mock;
  const docMock = doc as unknown as jest.Mock;
  const getDocMock = getDoc as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    clearThemeCookie();
    document.documentElement.removeAttribute('data-theme');
  });

  it('does not override existing theme when db preference is missing', async () => {
    useAuthMock.mockReturnValue({ user: { uid: 'user_1' } });
    docMock.mockReturnValue({ __type: 'docRef' });

    document.cookie = 'mcmp-theme-v2=liner';

    const deferred = createDeferred<any>();
    getDocMock.mockReturnValue(deferred.promise);

    render(
      <ThemeProvider initialTheme="liner">
        <ThemeReadout />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('liner');
    expect(document.cookie).toContain('mcmp-theme-v2=liner');

    await act(async () => {
      deferred.resolve({
        exists: () => true,
        data: () => ({})
      });
      await deferred.promise;
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('liner');
    expect(document.cookie).toContain('mcmp-theme-v2=liner');
  });
});
