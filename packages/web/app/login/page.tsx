'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errMsg, setErrMsg] = useState<string | null>(null);

  return (
    <main>
      <h1>Log in</h1>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErrMsg(null);
          try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = '/me';
          } catch (e: any) {
            setErrMsg(e?.message ?? 'Login failed');
          }
        }}
      >
        <div>
          <label>Email</label>
          <br />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Password</label>
          <br />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>

        <button style={{ marginTop: 12 }} type="submit">
          Log in
        </button>
      </form>

      {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

      <p>
        Need an account? <Link href="/signup">Sign up</Link>
      </p>
    </main>
  );
}
