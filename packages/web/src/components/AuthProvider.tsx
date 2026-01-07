'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthState = {
  user: User | null;
  role: 'unassigned' | 'artist' | 'creator' | 'admin' | string;
  loading: boolean;
};

const Ctx = createContext<AuthState>({ user: null, role: 'unassigned', loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>('unassigned');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole('unassigned');
        setLoading(false);
        return;
      }
      try {
        const token = await getIdTokenResult(u, true);
        setRole((token.claims as any)?.role ?? 'unassigned');
      } catch {
        setRole('unassigned');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthState>(() => ({ user, role, loading }), [user, role, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
