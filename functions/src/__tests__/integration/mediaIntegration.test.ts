import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, ref as storageRef, uploadBytes, type FirebaseStorage } from 'firebase/storage';

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
  storage: FirebaseStorage;
}> {
  const app = initializeApp(firebaseConfig, `integration-media-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);

  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);

  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);

  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;
  await waitForUserDoc(firestore, uid);

  return { app, uid, functions, firestore, storage };
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

describe('integration: media', () => {
  test('attachMediaToPost enforces ownership', async () => {
    const a = await initEmulatorClient('a');
    const b = await initEmulatorClient('b');

    try {
      const createPostA = httpsCallable(a.functions, 'createPost');
      const postARes = await createPostA({ caption: 'post a', tags: [], visibility: 'public' });
      const postAId = String((postARes.data as any)?.postId ?? '');
      expect(postAId).toBeTruthy();

      const createPostB = httpsCallable(b.functions, 'createPost');
      const postBRes = await createPostB({ caption: 'post b', tags: [], visibility: 'public' });
      const postBId = String((postBRes.data as any)?.postId ?? '');
      expect(postBId).toBeTruthy();

      const initiate = httpsCallable(b.functions, 'initiateMediaUpload');
      const declaredBytes = 4;
      const initRes = await initiate({ kind: 'image', mimeType: 'image/png', sizeBytes: declaredBytes, originalFilename: 'x.png' });
      const uploadId = String((initRes.data as any)?.uploadId ?? '');
      const storagePath = String((initRes.data as any)?.storagePath ?? '');
      expect(uploadId).toBeTruthy();
      expect(storagePath).toContain(`socialUploads/${b.uid}/${uploadId}/`);

      // Upload bytes to the staging path.
      await uploadBytes(storageRef(b.storage, storagePath), new Uint8Array([1, 2, 3, 4]), { contentType: 'image/png' });

      const finalize = httpsCallable(b.functions, 'finalizeMediaUpload');
      const finRes = await finalize({ uploadId });
      const assetId = String((finRes.data as any)?.assetId ?? '');
      expect(assetId).toBeTruthy();

      const attach = httpsCallable(b.functions, 'attachMediaToPost');
      await expectCallableError(attach({ postId: postAId, assetId }), { codeIncludes: 'permission-denied', messageIncludes: 'NOT_OWNER' });

      // Owner can attach to own post.
      const okRes = await attach({ postId: postBId, assetId });
      expect((okRes.data as any)?.ok).toBe(true);
    } finally {
      await Promise.all([deleteApp(a.app), deleteApp(b.app)]);
    }
  });

  test('initiateMediaUpload rejects oversized declared files', async () => {
    const u = await initEmulatorClient('oversize');
    try {
      const initiate = httpsCallable(u.functions, 'initiateMediaUpload');
      await expectCallableError(
        initiate({ kind: 'image', mimeType: 'image/png', sizeBytes: 999_999_999, originalFilename: 'x.png' }),
        { codeIncludes: 'invalid-argument', messageIncludes: 'FILE_TOO_LARGE' }
      );
    } finally {
      await deleteApp(u.app);
    }
  });
});
