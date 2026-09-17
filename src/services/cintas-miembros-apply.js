import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_CINTAS_MIEMBROS } from 'src/utils/cintas-perfil.mjs';

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
