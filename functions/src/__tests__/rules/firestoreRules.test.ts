import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore';

const PROJECT_ID = 'demo-mcmp';

function rulesPath(rel: string): string {
  return path.resolve(__dirname, `../../../../${rel}`);
}

describe('Firestore rules (social + core)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Avoid noisy "GrpcConnection ... PERMISSION_DENIED" warnings for expected assertFails().
    setLogLevel('error');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(rulesPath('firestore.rules'), 'utf8')
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  test('public can read handles/{handle} and publicProfiles/{uid}', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'handles', 'guest_amber_echo_0001'), { handle: 'guest_amber_echo_0001', uid: 'u1', createdAt: '2026-01-01T00:00:00.000Z' });
      await setDoc(doc(db, 'publicProfiles', 'u1'), { uid: 'u1', handle: 'guest_amber_echo_0001', displayName: 'Guest' });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonDb, 'handles', 'guest_amber_echo_0001')));
    await assertSucceeds(getDoc(doc(anonDb, 'publicProfiles', 'u1')));
  });

  test('public cannot read users/{uid} or creatorPrivate/{uid}', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', 'u1'), { uid: 'u1', status: 'active' });
      await setDoc(doc(db, 'creatorPrivate', 'u1'), { uid: 'u1', secret: 'nope' });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'users', 'u1')));
    await assertFails(getDoc(doc(anonDb, 'creatorPrivate', 'u1')));
  });

  test('public can read public posts on public accounts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', 'p1'), {
        postId: 'p1',
        authorUid: 'a',
        authorIsPrivateAccount: false,
        visibility: 'public',
        caption: 'hello',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonDb, 'posts', 'p1')));
  });

  test('public cannot read follower-only posts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', 'p2'), {
        postId: 'p2',
        authorUid: 'a',
        authorIsPrivateAccount: false,
        visibility: 'followers',
        caption: 'secret',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'posts', 'p2')));
  });

  test('approved followers can read follower-only posts and private-account posts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', 'p3'), {
        postId: 'p3',
        authorUid: 'author',
        authorIsPrivateAccount: false,
        visibility: 'followers',
        caption: 'followers',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
      await setDoc(doc(db, 'posts', 'p4'), {
        postId: 'p4',
        authorUid: 'author',
        authorIsPrivateAccount: true,
        visibility: 'public',
        caption: 'private account still hidden',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
      await setDoc(doc(db, 'posts', 'p4b'), {
        postId: 'p4b',
        authorUid: 'author',
        authorIsPrivateAccount: true,
        visibility: 'private',
        caption: 'author only',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
      await setDoc(doc(db, 'follows', 'author', 'followers', 'viewer'), { status: 'approved' });
    });

    const viewerDb = testEnv.authenticatedContext('viewer', { role: 'unassigned' }).firestore();
    await assertSucceeds(getDoc(doc(viewerDb, 'posts', 'p3')));
    await assertSucceeds(getDoc(doc(viewerDb, 'posts', 'p4')));
    await assertFails(getDoc(doc(viewerDb, 'posts', 'p4b')));
  });

  test('non-approved followers cannot read private-account posts', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'posts', 'p5'), {
        postId: 'p5',
        authorUid: 'author',
        authorIsPrivateAccount: true,
        visibility: 'public',
        caption: 'hidden',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
    });

    const viewerDb = testEnv.authenticatedContext('viewer', { role: 'unassigned' }).firestore();
    await assertFails(getDoc(doc(viewerDb, 'posts', 'p5')));
  });

  test('clients cannot write to posts directly', async () => {
    const viewerDb = testEnv.authenticatedContext('viewer', { role: 'unassigned' }).firestore();
    await assertFails(
      setDoc(doc(viewerDb, 'posts', 'x'), {
        postId: 'x',
        authorUid: 'viewer',
        authorIsPrivateAccount: false,
        visibility: 'public',
        caption: 'nope',
        createdAt: '2026-01-01T00:00:00.000Z'
      })
    );
  });

  test('clients cannot write to handles/publicProfiles directly', async () => {
    const viewerDb = testEnv.authenticatedContext('viewer', { role: 'unassigned' }).firestore();
    await assertFails(setDoc(doc(viewerDb, 'handles', 'abc'), { handle: 'abc', uid: 'viewer' }));
    await assertFails(setDoc(doc(viewerDb, 'publicProfiles', 'viewer'), { uid: 'viewer', handle: 'abc' }));
  });

  test('followers graph read is limited to parties', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'follows', 'target', 'followers', 'f1'), { status: 'approved' });
    });

    const outsiderDb = testEnv.authenticatedContext('outsider', { role: 'unassigned' }).firestore();
    await assertFails(getDoc(doc(outsiderDb, 'follows', 'target', 'followers', 'f1')));

    const followerDb = testEnv.authenticatedContext('f1', { role: 'unassigned' }).firestore();
    await assertSucceeds(getDoc(doc(followerDb, 'follows', 'target', 'followers', 'f1')));

    const targetDb = testEnv.authenticatedContext('target', { role: 'unassigned' }).firestore();
    await assertSucceeds(getDoc(doc(targetDb, 'follows', 'target', 'followers', 'f1')));
  });

  test('rateLimits is not readable/writable by clients (once added)', async () => {
    const viewerDb = testEnv.authenticatedContext('viewer', { role: 'unassigned' }).firestore();
    await assertFails(getDoc(doc(viewerDb, 'rateLimits', 'any')));
    await assertFails(setDoc(doc(viewerDb, 'rateLimits', 'any'), { count: 1 }));
  });

  test('reports are readable by admin and reporter only', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'reports', 'r1'), {
        reportId: 'r1',
        status: 'open',
        targetType: 'post',
        reporterUid: 'u1',
        targetUid: 'u2',
        postId: 'p1',
        commentId: null,
        reasonCode: 'spam',
        message: 'spam',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      });
    });

    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'reports', 'r1')));

    const otherDb = testEnv.authenticatedContext('u3', { role: 'unassigned' }).firestore();
    await assertFails(getDoc(doc(otherDb, 'reports', 'r1')));

    const reporterDb = testEnv.authenticatedContext('u1', { role: 'unassigned' }).firestore();
    await assertSucceeds(getDoc(doc(reporterDb, 'reports', 'r1')));

    const adminDb = testEnv.authenticatedContext('admin', { role: 'admin' }).firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'reports', 'r1')));
  });

  test('blocks/mutes are readable only by the owner uid', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'blocks', 'u1', 'blocked', 'u2'), { targetUid: 'u2', createdAt: '2026-01-01T00:00:00.000Z' });
      await setDoc(doc(db, 'mutes', 'u1', 'muted', 'u2'), { targetUid: 'u2', createdAt: '2026-01-01T00:00:00.000Z' });
    });

    const u1Db = testEnv.authenticatedContext('u1', { role: 'unassigned' }).firestore();
    await assertSucceeds(getDoc(doc(u1Db, 'blocks', 'u1', 'blocked', 'u2')));
    await assertSucceeds(getDoc(doc(u1Db, 'mutes', 'u1', 'muted', 'u2')));

    const u2Db = testEnv.authenticatedContext('u2', { role: 'unassigned' }).firestore();
    await assertFails(getDoc(doc(u2Db, 'blocks', 'u1', 'blocked', 'u2')));
    await assertFails(getDoc(doc(u2Db, 'mutes', 'u1', 'muted', 'u2')));
  });
});
