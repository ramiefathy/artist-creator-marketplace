import * as admin from 'firebase-admin';
import type { Bucket } from '@google-cloud/storage';

let initialized = false;

export function initAdmin(): admin.app.App {
  if (!initialized) {
    admin.initializeApp();
    initialized = true;
  }
  return admin.app();
}

export function db(): FirebaseFirestore.Firestore {
  initAdmin();
  return admin.firestore();
}

export function auth(): admin.auth.Auth {
  initAdmin();
  return admin.auth();
}

export function bucket(): Bucket {
  initAdmin();
  return admin.storage().bucket();
}
