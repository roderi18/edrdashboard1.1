import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_CONFIGURACION_CINTAS } from 'src/utils/cintas-perfil.mjs';
import { DOCUMENTO_ORDEN_PINES, COLECCION_PINES_MIEMBROS } from 'src/utils/pines-perfil.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA los pines del perfil de un miembro y su orden global.
//
// Mismo caso que `medallas-miembros-apply.js`: aquí solo vive la escritura que
// `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const referenciaDePines = (idMiembros) =>
  doc(FIRESTORE, COLECCION_PINES_MIEMBROS, String(idMiembros));

export const escribirPinesDeMiembro = (idMiembros, pines, actualizadoPor = '') =>
  setDoc(referenciaDePines(idMiembros), {
    idMiembros: Number(idMiembros),
    pines,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });

export const referenciaDeOrdenDePines = () =>
  doc(FIRESTORE, COLECCION_CONFIGURACION_CINTAS, DOCUMENTO_ORDEN_PINES);

export const escribirOrdenDePines = (orden, actualizadoPor = '') =>
  setDoc(referenciaDeOrdenDePines(), {
    orden,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });
