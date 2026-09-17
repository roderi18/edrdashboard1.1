import { doc, setDoc, getDocs, collection, writeBatch, serverTimestamp } from 'firebase/firestore';

import { COLECCION_ESTATUS_MIEMBROS } from 'src/utils/estatus-por-asistencia.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el estatus de cada miembro (`estatus_miembros/{id}`).
//
// Mismo caso que `sonidos-apply.js`: aquí solo vive la escritura. El estatus lo
// mueve la regla de asistencia (`estatus-miembros-service.js`), que decide y
// registra antes de llamar aquí.
//
// El estatus vive en la API .NET, pero la asistencia y las rachas están en
// Firestore: este documento es el que lleva la cuenta (faltas seguidas,
// presencias seguidas, última presencia y desde cuándo está así).
// ----------------------------------------------------------------------

export const referenciaDeEstatus = (idMiembros) =>
  doc(FIRESTORE, COLECCION_ESTATUS_MIEMBROS, String(idMiembros));

export const leerEstatusGuardados = async () => {
  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_ESTATUS_MIEMBROS)).catch(
    () => null
  );
  const registros = new Map();

  snapshot?.docs?.forEach((item) => registros.set(item.id, item.data() ?? {}));

  return registros;
};

export const escribirEstatusDeMiembro = (registro) =>
  setDoc(
    referenciaDeEstatus(registro.idMiembros),
    { ...registro, actualizadoEn: serverTimestamp() },
    { merge: true }
  );

/** Varios de golpe: un pase de lista puede mover a media docena. */
export const escribirEstatusDeMiembros = async (registros = []) => {
  if (!registros.length) return;

  const batch = writeBatch(FIRESTORE);

  registros.forEach((registro) =>
    batch.set(
      referenciaDeEstatus(registro.idMiembros),
      { ...registro, actualizadoEn: serverTimestamp() },
      { merge: true }
    )
  );

  await batch.commit();
};
