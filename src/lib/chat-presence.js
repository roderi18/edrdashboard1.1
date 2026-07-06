import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_PRESENCIA = 'presencia_chat';
export const HEARTBEAT_INTERVAL_MS = 20000;
export const STALE_AFTER_MS = 45000;

export async function setPresence(idMiembros, estado) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return;

  await setDoc(
    doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros)),
    { estado, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
}
