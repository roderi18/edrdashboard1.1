import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_ESTADO_DESTACAMENTOS } from 'src/utils/estado-destacamento.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el estado de un destacamento (Activo / Inactivo).
//
// Mismo caso que `pines-miembros-apply.js`: aquí solo vive la escritura que
// `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const referenciaDeEstadoDeDestacamento = (idDestacamento) =>
  doc(FIRESTORE, COLECCION_ESTADO_DESTACAMENTOS, String(idDestacamento));

export const escribirEstadoDeDestacamento = (idDestacamento, estado, actualizadoPor = '') =>
  setDoc(referenciaDeEstadoDeDestacamento(idDestacamento), {
    idDestacamento: String(idDestacamento),
    estado,
    actualizadoEn: serverTimestamp(),
    actualizadoPor,
  });
