import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const isFirebase = CONFIG.auth.method === 'firebase';
const requiredFirebaseConfig = [
  ['apiKey', 'NEXT_PUBLIC_FIREBASE_API_KEY'],
  ['authDomain', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
  ['projectId', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
  ['storageBucket', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
  ['messagingSenderId', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
  ['appId', 'NEXT_PUBLIC_FIREBASE_APP_ID'],
];

export const missingFirebaseConfigKeys = requiredFirebaseConfig
  .filter(([key]) => !CONFIG.firebase[key])
  .map(([, envKey]) => envKey);

const hasFirebaseConfig = missingFirebaseConfigKeys.length === 0;

export const isFirebaseConfigured = isFirebase && hasFirebaseConfig;

export const firebaseApp = isFirebaseConfigured ? initializeApp(CONFIG.firebase) : null;

export const AUTH = isFirebaseConfigured ? getAuth(firebaseApp) : null;

export const FIRESTORE = isFirebaseConfigured ? getFirestore(firebaseApp) : null;

export const FIREBASE_STORAGE = isFirebaseConfigured ? getStorage(firebaseApp) : null;
