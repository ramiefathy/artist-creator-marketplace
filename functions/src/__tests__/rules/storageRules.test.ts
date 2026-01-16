import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-mcmp';

function rulesPath(rel: string): string {
  return path.resolve(__dirname, `../../../../${rel}`);
}

describe('Storage rules (social + protected assets)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        host: '127.0.0.1',
        port: 9199,
        rules: readFileSync(rulesPath('storage.rules'), 'utf8')
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test('storage reads are denied', async () => {
    const anonStorage = testEnv.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(anonStorage, 'anything.txt')));
  });

  test('unauthenticated users cannot upload to socialUploads', async () => {
    const anonStorage = testEnv.unauthenticatedContext().storage();
    const fileRef = ref(anonStorage, 'socialUploads/u1/up1/file.txt');
    await assertFails(uploadBytes(fileRef, new Uint8Array([1, 2, 3])));
  });

  test('authenticated user can upload to their own socialUploads path', async () => {
    const userStorage = testEnv.authenticatedContext('u1', { role: 'unassigned' }).storage();
    const fileRef = ref(userStorage, 'socialUploads/u1/up1/file.txt');
    await assertSucceeds(uploadBytes(fileRef, new Uint8Array([1, 2, 3])));
  });

  test('authenticated user cannot upload to someone else’s socialUploads path', async () => {
    const userStorage = testEnv.authenticatedContext('u1', { role: 'unassigned' }).storage();
    const fileRef = ref(userStorage, 'socialUploads/u2/up1/file.txt');
    await assertFails(uploadBytes(fileRef, new Uint8Array([1, 2, 3])));
  });

  test('clients cannot upload to final socialMedia path', async () => {
    const userStorage = testEnv.authenticatedContext('u1', { role: 'unassigned' }).storage();
    const fileRef = ref(userStorage, 'socialMedia/asset1/file.txt');
    await assertFails(uploadBytes(fileRef, new Uint8Array([1, 2, 3])));
  });
});

