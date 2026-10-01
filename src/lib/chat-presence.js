import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

export const COLECCION_PRESENCIA = 'presencia_chat';
// Con la pestaña en segundo plano el navegador retrasa los temporizadores hasta
// un minuto: con 60 s de latido y 150 s de caducidad, a veces se pasaba y quien
// seguia conectado parpadeaba en gris. Latido mas corto y margen mas holgado.
export const HEARTBEAT_INTERVAL_MS = 45000;
export const STALE_AFTER_MS = 180000;

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

/**
 * Los buzones compartidos que atiende (claves de `chat-buzones.mjs`): el buzon
 * sale en linea si alguno de quienes lo atienden lo esta. Escritura APARTE del
 * latido: si las reglas aun no admiten el campo, se rechaza esta y la presencia
 * de la persona sigue funcionando.
 */
export async function setBuzonesQueAtiende(idMiembros, atiende = []) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return;

  // Presencia del chat, no un dato de la organizacion: no pasa por Historial.
  // eslint-disable-next-line no-restricted-syntax
  await setDoc(
    doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros)),
    { idMiembros: Number(idMiembros), atiende },
    { merge: true }
  );
}

/**
 * BORRA LAS SESIONES CADUCADAS del documento propio. Al cerrar o recargar la
 * pestaña no siempre llega a borrarse la suya (`pagehide` no es fiable), y el
 * documento acumulaba cientos de sesiones viejas —hasta de semanas— que cada
 * lector descargaba y recorria en cada cambio. Se limpia al abrir la aplicacion.
 */
export async function podarSesionesCaducadas(idMiembros, { ahora = Date.now() } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE || !idMiembros) return;

  const referencia = doc(FIRESTORE, COLECCION_PRESENCIA, String(idMiembros));
  const actual = await getDoc(referencia);
  const sesiones = actual.exists() ? actual.data()?.sesiones || {} : {};
  const caducadas = Object.entries(sesiones)
    .filter(([, sesion]) => {
      const marca =
        sesion?.actualizadoEn?.toMillis?.() ?? (Number(sesion?.actualizadoEnCliente) || 0);

      return !marca || ahora - marca > STALE_AFTER_MS * 2;
    })
    .map(([id]) => id);

  if (!caducadas.length) return;

  // Presencia del chat, no un dato de la organizacion: no pasa por Historial.
  // eslint-disable-next-line no-restricted-syntax
  await updateDoc(
    referencia,
    Object.fromEntries(caducadas.map((id) => [`sesiones.${id}`, deleteField()]))
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
