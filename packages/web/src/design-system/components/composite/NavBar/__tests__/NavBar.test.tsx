import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { NavBar } from '@/design-system/components/composite/NavBar/NavBar';
import { useAuth } from '@/components/AuthProvider';
import { getDoc } from 'firebase/firestore';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  )
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/me'
}));

jest.mock('@/components/AuthProvider', () => ({
  useAuth: jest.fn()
}));

jest.mock('@/lib/flags', () => ({
  isSocialEnabled: () => false
}));

jest.mock('@/lib/firebase', () => ({
  db: {}
}));

jest.mock('@/design-system/components/theme', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />
}));

jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ collection, id }),
  getDoc: jest.fn()
}));

describe('NavBar', () => {
  const useAuthMock = useAuth as jest.Mock;
  const getDocMock = getDoc as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears stale handle when profile doc is missing', async () => {
    const user1 = { uid: 'u1', email: 'alice@example.com', isAnonymous: false };
    const user2 = { uid: 'u2', email: 'bob@example.com', isAnonymous: false };

    useAuthMock.mockReturnValue({ user: user1, role: 'creator', loading: false });

    getDocMock.mockImplementation(async (ref: any) => {
      if (ref.collection === 'publicProfiles' && ref.id === 'u1') {
        return { exists: () => true, data: () => ({ handle: 'alice' }) };
      }
      if (ref.collection === 'publicProfiles' && ref.id === 'u2') {
        return { exists: () => false, data: () => ({}) };
      }
      return { exists: () => false, data: () => ({}) };
    });

    const { rerender } = render(<NavBar />);

    await screen.findByText('@alice');

    useAuthMock.mockReturnValue({ user: user2, role: 'creator', loading: false });
    rerender(<NavBar />);

    await waitFor(() => {
      expect(screen.queryByText('@alice')).not.toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });
  });
});

