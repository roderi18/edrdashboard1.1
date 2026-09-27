import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { leerConCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  normalizarSendaInstructor,
  COLECCION_SENDA_INSTRUCTOR,
} from 'src/utils/senda-instructor.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// Lectura y escritura de la Senda del Instructor de un miembro (ver
// `src/utils/senda-instructor.mjs`). Sin documento: sin senda.

const referencia = (idMiembro) => doc(FIRESTORE, COLECCION_SENDA_INSTRUCTOR, String(idMiembro));

export function leerSendaInstructor(idMiembro) {
  if (!idMiembro || !isFirebaseConfigured || !FIRESTORE) return Promise.resolve([]);
  return leerConCache(`senda-instructor:${idMiembro}`, async () => {
    const snap = await getDoc(referencia(idMiembro));
    return normalizarSendaInstructor(snap.exists() ? snap.data()?.niveles : []);
  });
}

async function guardarSendaInstructorDirecto({ idMiembro, niveles, usuario = {} }) {
  if (!idMiembro || !FIRESTORE) throw new Error('Falta el miembro.');
  // Es un dato del miembro, no un cambio de la organización.
  // eslint-disable-next-line no-restricted-syntax
  await setDoc(referencia(idMiembro), {
    idMiembros: String(idMiembro),
    niveles: normalizarSendaInstructor(niveles),
    actualizadoPor: String(usuario?.uid ?? usuario?.id ?? ''),
    actualizadoEn: serverTimestamp(),
  });
}

export const guardarSendaInstructor = conInvalidacion(guardarSendaInstructorDirecto, [
  'senda-instructor:',
]);
