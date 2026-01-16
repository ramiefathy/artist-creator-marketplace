import 'server-only';

import { initializeApp, getApps } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const publicDb = getFirestore(app);

// The public pages only read publicly-readable projections, so we don't need auth on the server.
// For local dev, support the Firestore emulator.
if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(publicDb, '127.0.0.1', 8080);
}

