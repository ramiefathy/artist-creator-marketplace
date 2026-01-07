import * as admin from 'firebase-admin';
import { db } from '../init';

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowTs(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.now();
}

export function col(name: string) {
  return db().collection(name);
}

export function docRef(collection: string, id: string) {
  return db().collection(collection).doc(id);
}
