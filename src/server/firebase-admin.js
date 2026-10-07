import 'server-only';

import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

// ----------------------------------------------------------------------
// Inicialización del Admin SDK (solo server). Lee el service account desde la
// variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON en una línea). NUNCA se
// versiona la clave. Se usa para verificar tokens y setear custom claims.
// ----------------------------------------------------------------------

let cachedAuth = null;
let cachedDb = null;

const parseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT no está definido. Genera un service account en Firebase Console y colócalo en el entorno.'
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT no es JSON válido: ${error.message}`);
  }

  // Si la private_key vino con saltos escapados (\\n), restaurarlos.
  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
};

const ensureApp = () => {
  const existing = getApps();
  if (existing.length) return existing[0];

  const serviceAccount = parseServiceAccount();

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
};

export const getAdminAuth = () => {
  if (!cachedAuth) cachedAuth = getAuth(ensureApp());
  return cachedAuth;
};

export const getAdminDb = () => {
  if (!cachedDb) cachedDb = getFirestore(ensureApp());
  return cachedDb;
};

// El bucket de Storage del proyecto (el mismo que usa el navegador).
export const getAdminBucket = () => {
  const app = ensureApp();
  return getStorage(app).bucket(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${app.options.projectId}.firebasestorage.app`
  );
};

export const isAdminConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
