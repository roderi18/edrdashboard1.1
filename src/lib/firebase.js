import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const isFirebase = CONFIG.auth.method === 'firebase';
const hasFirebaseConfig = Boolean(
  CONFIG.firebase.apiKey &&
  CONFIG.firebase.authDomain &&
  CONFIG.firebase.projectId &&
  CONFIG.firebase.storageBucket &&
  CONFIG.firebase.messagingSenderId &&
  CONFIG.firebase.appId
);

export const isFirebaseConfigured = isFirebase && hasFirebaseConfig;

export const firebaseApp = isFirebaseConfigured ? initializeApp(CONFIG.firebase) : null;

export const AUTH = isFirebaseConfigured ? getAuth(firebaseApp) : null;

export const FIRESTORE = isFirebaseConfigured ? getFirestore(firebaseApp) : null;

export const FIREBASE_STORAGE = isFirebaseConfigured ? getStorage(firebaseApp) : null;
