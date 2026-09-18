import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_CONFIGURACION_CINTAS } from 'src/utils/cintas-perfil.mjs';
import {
  DOCUMENTO_ORDEN_MEDALLAS,
  COLECCION_MEDALLAS_MIEMBROS,
} from 'src/utils/medallas-perfil.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA las medallas del perfil de un miembro y su orden global.
//
// Mismo caso que `cintas-miembros-apply.js`: aquí solo vive la escritura que
// `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const referenciaDeMedallas = (idMiembros) =>
  doc(FIRESTORE, COLECCION_MEDALLAS_MIEMBROS, String(idMiembros));

export const escribirMedallasDeMiembro = (idMiembros, medallas, actualizadoPor = '') =>
  setDoc(referenciaDeMedallas(idMiembros), {
    idMiembros: Number(idMiembros),
    medallas,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });

export const referenciaDeOrdenDeMedallas = () =>
  doc(FIRESTORE, COLECCION_CONFIGURACION_CINTAS, DOCUMENTO_ORDEN_MEDALLAS);

export const escribirOrdenDeMedallas = (orden, actualizadoPor = '') =>
  setDoc(referenciaDeOrdenDeMedallas(), {
    orden,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });
