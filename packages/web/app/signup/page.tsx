'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  return (
    <main>
      <h1>Sign up</h1>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErrMsg(null);
          try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(cred.user);
            setCreated(true);
          } catch (e: any) {
            setErrMsg(e?.message ?? 'Sign up failed');
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
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required />
        </div>

        <button style={{ marginTop: 12 }} type="submit">
          Create account
        </button>
      </form>

      {created ? (
        <div style={{ marginTop: 12 }}>
          <p>Account created. Please verify your email, then continue.</p>
          <p><Link href="/me">Go to My account</Link></p>
        </div>
      ) : null}

      {errMsg ? <p style={{ color: 'crimson' }}>{errMsg}</p> : null}

      <p>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
