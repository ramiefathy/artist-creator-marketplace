import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';

jest.setTimeout(60_000);

const firebaseConfig = {
  apiKey: 'fake',
  authDomain: 'demo-mcmp.firebaseapp.com',
  projectId: 'demo-mcmp',
  appId: '1:demo:web:test',
  storageBucket: 'demo-mcmp.appspot.com'
};

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForUserDoc(db: Firestore, uid: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for users/${uid} (auth trigger may not be running in emulator).`);
}

async function initEmulatorClient(name: string): Promise<{
  app: FirebaseApp;
  uid: string;
  functions: Functions;
  firestore: Firestore;
}> {
  const app = initializeApp(firebaseConfig, `integration-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);

  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;
  await waitForUserDoc(firestore, uid);

  return { app, uid, functions, firestore };
}

async function expectCallableError(p: Promise<unknown>, opts: { codeIncludes: string; messageIncludes?: string }): Promise<void> {
  try {
    await p;
    throw new Error('Expected callable to fail, but it succeeded.');
  } catch (e: any) {
    const code = String(e?.code ?? '');
    const msg = String(e?.message ?? '');
    expect(code).toContain(opts.codeIncludes);
    if (opts.messageIncludes) expect(msg).toContain(opts.messageIncludes);
  }
}

describe('integration: blocks', () => {
  test('blocked users cannot comment/like/follow', async () => {
    const a = await initEmulatorClient('a');
    const b = await initEmulatorClient('b');

    try {
      const createPost = httpsCallable(a.functions, 'createPost');
      const postRes = await createPost({ caption: 'hello', tags: [], visibility: 'public' });
      const postId = String((postRes.data as any)?.postId ?? '');
      expect(postId).toBeTruthy();

      const blockUser = httpsCallable(a.functions, 'blockUser');
      await blockUser({ targetUid: b.uid });

      const createComment = httpsCallable(b.functions, 'createComment');
      await expectCallableError(createComment({ postId, body: 'hi', parentCommentId: null }), {
        codeIncludes: 'permission-denied',
        messageIncludes: 'BLOCKED'
      });

      const toggleLike = httpsCallable(b.functions, 'toggleLike');
      await expectCallableError(toggleLike({ postId, like: true }), { codeIncludes: 'permission-denied', messageIncludes: 'BLOCKED' });

      const requestFollow = httpsCallable(b.functions, 'requestFollow');
      await expectCallableError(requestFollow({ targetUid: a.uid }), { codeIncludes: 'permission-denied', messageIncludes: 'BLOCKED' });
    } finally {
      await Promise.all([deleteApp(a.app), deleteApp(b.app)]);
    }
  });
});
