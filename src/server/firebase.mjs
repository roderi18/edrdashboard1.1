import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';

// Adaptado del servidor de errd-registro: las credenciales solo viven en el servidor.
function app() {
  if (getApps().length) return getApps()[0];
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'systexploradores.firebasestorage.app';
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return initializeApp({ credential: applicationDefault(), storageBucket });
  const account = JSON.parse(raw.trim().replace(/^'(.*)'$/s, '$1'));
  account.private_key = String(account.private_key || '').replace(/\\n/g, '\n');
  return initializeApp({ credential: cert(account), storageBucket });
}

export const db = () => getFirestore(app());
export const bucket = () => getStorage(app()).bucket();
