import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import {
  DOCUMENTO_ORDEN_CINTAS,
  COLECCION_CINTAS_MIEMBROS,
  COLECCION_CONFIGURACION_CINTAS,
} from 'src/utils/cintas-perfil.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA las cintas del perfil de un miembro.
//
// Mismo caso que `sonidos-apply.js`: aquí solo vive la escritura que
// `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const referenciaDeCintas = (idMiembros) =>
  doc(FIRESTORE, COLECCION_CINTAS_MIEMBROS, String(idMiembros));

export const escribirCintasDeMiembro = (idMiembros, cintas, actualizadoPor = '') =>
  setDoc(referenciaDeCintas(idMiembros), {
    idMiembros: Number(idMiembros),
    cintas,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });

// El orden global de las cintas (EXPLORA Designer → Cintas).
export const referenciaDeOrdenDeCintas = () =>
  doc(FIRESTORE, COLECCION_CONFIGURACION_CINTAS, DOCUMENTO_ORDEN_CINTAS);

export const escribirOrdenDeCintas = (orden, actualizadoPor = '') =>
  setDoc(referenciaDeOrdenDeCintas(), {
    orden,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });
