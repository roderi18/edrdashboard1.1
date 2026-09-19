import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_INSIGNIAS_PERSONALIZADAS } from 'src/utils/insignias-personalizadas.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el alta de una cinta o medalla desde EXPLORA Designer.
//
// Mismo caso que `cintas-miembros-apply.js`: aquí solo vive la escritura que
// `proponerCambio` ejecuta DESPUÉS de haberla registrado en Historial.
// ----------------------------------------------------------------------

export const escribirInsigniaPersonalizada = (documento, creadaPor = '') =>
  setDoc(doc(FIRESTORE, COLECCION_INSIGNIAS_PERSONALIZADAS, documento.id), {
    ...documento,
    creadaPor,
    creadaEn: serverTimestamp(),
  });
