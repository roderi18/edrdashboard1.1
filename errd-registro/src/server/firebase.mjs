import 'server-only';

import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';

// ----------------------------------------------------------------------
// Admin SDK de la landing. Solo corre en el servidor: el navegador nunca ve la
// cuenta de servicio. Lee FIREBASE_SERVICE_ACCOUNT (JSON en una línea), igual
// que el dashboard.
// ----------------------------------------------------------------------

const app = () => {
  if (getApps().length) return getApps()[0];

  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'systexploradores.firebasestorage.app';
  // En Firebase Hosting (Cloud Functions) no hace falta la cuenta de servicio:
  // se usan las credenciales propias del servidor, y la clave no sale del equipo.
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return initializeApp({ credential: applicationDefault(), storageBucket: bucketName });
  }

  const cuenta = JSON.parse(String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim().replace(/^'(.*)'$/s, '$1'));
  cuenta.private_key = String(cuenta.private_key || '').replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert(cuenta),
    storageBucket: bucketName,
  });
};

export const db = () => getFirestore(app());
export const bucket = () => getStorage(app()).bucket();
