import { doc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_PRESENCIA = 'presencia_chat';
export const HEARTBEAT_INTERVAL_MS = 20000;
export const STALE_AFTER_MS = 45000;

const MANUAL_PRESENCE_STATUSES = new Set(['always', 'busy']);

export async function setPresence(idMiembros, estado) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return;

  await setDoc(
    doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros)),
    { idMiembros: Number(idMiembros), estado, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
}

export async function setPresenceSession(idMiembros, sessionId, { visible } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros || !sessionId) return;

  await setDoc(
    doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros)),
    {
      idMiembros: Number(idMiembros),
      sesiones: {
        [sessionId]: {
          visible: Boolean(visible),
          actualizadoEn: serverTimestamp(),
          actualizadoEnCliente: Date.now(),
        },
      },
    },
    { merge: true }
  );
}

export async function removePresenceSession(idMiembros, sessionId) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros || !sessionId) return;

  await updateDoc(doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros)), {
    [`sesiones.${sessionId}`]: deleteField(),
  }).catch(() => {});
}

export async function setManualPresenceOverride(idMiembros, estado) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return;

  const manualStatus = MANUAL_PRESENCE_STATUSES.has(estado) ? estado : null;

  await setDoc(
    doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros)),
    {
      idMiembros: Number(idMiembros),
      estadoManual: manualStatus ?? deleteField(),
      estadoManualActualizadoEn: serverTimestamp(),
    },
    { merge: true }
  );
}
