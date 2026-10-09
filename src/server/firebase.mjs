import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';

// Adaptado del servidor de errd-registro: las credenciales solo viven en el servidor.

// EL BUCKET ES EL DEL MISMO PROYECTO QUE LA CUENTA DE SERVICIO. Firestore ya
// sigue a la cuenta; el bucket salía de la variable de entorno, y un backend de
// desarrollo sin su `apphosting.dev.yaml` aplicado leía Firestore de dev pero
// intentaba guardar los comprobantes en el bucket de producción («does not have
// storage.objects.create»). Si la variable apunta a otro proyecto, manda la cuenta.
export const bucketDelProyecto = (configurado, proyecto) => {
  if (!proyecto) return configurado || 'systexploradores.firebasestorage.app';
  return configurado && configurado.startsWith(`${proyecto}.`)
    ? configurado
    : `${proyecto}.firebasestorage.app`;
};

function app() {
  if (getApps().length) return getApps()[0];
  const configurado = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw)
    return initializeApp({
      credential: applicationDefault(),
      storageBucket: bucketDelProyecto(configurado, ''),
    });
  const account = JSON.parse(raw.trim().replace(/^'(.*)'$/s, '$1'));
  account.private_key = String(account.private_key || '').replace(/\\n/g, '\n');
  return initializeApp({
    credential: cert(account),
    storageBucket: bucketDelProyecto(configurado, account.project_id),
  });
}

export const db = () => getFirestore(app());
export const bucket = () => getStorage(app()).bucket();
