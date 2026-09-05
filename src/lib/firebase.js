import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

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

// ----------------------------------------------------------------------
// FIRESTORE, CON MEMORIA EN EL PROPIO DISPOSITIVO.
//
// El pase de lista se hace donde no siempre hay señal —un campamento, una
// iglesia sin cobertura—. Con la cache persistente, lo que se marca se guarda en
// el disco del navegador, la pantalla responde como si ya estuviera escrito, y
// Firestore lo envia solo en cuanto vuelve la conexion.
//
// `persistentMultipleTabManager` porque la aplicacion se abre en varias pestañas
// con normalidad; sin el, solo la primera tendria memoria y las demas irian a
// ciegas.
//
// Si el navegador no deja (modo privado, almacenamiento lleno, un motor viejo),
// se cae a la version de siempre: sin memoria local, pero funcionando.
// ----------------------------------------------------------------------
const crearFirestore = () => {
  if (!isFirebaseConfigured) return null;

  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (error) {
    console.warn('[firebase] sin memoria local; se sigue solo en linea', error);

    return getFirestore(firebaseApp);
  }
};

export const FIRESTORE = crearFirestore();

export const FIREBASE_STORAGE = isFirebaseConfigured ? getStorage(firebaseApp) : null;
