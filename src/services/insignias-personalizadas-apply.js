import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_INSIGNIAS_PERSONALIZADAS } from 'src/utils/insignias-personalizadas.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el alta de una cinta o medalla desde EXPEDITION Designer.
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

// Editar o eliminar: solo los campos que cambian (merge), sin tocar quién la creó.
// Sirve también para el AJUSTE de una de fábrica, que se crea la primera vez.
export const actualizarInsigniaPersonalizada = (id, campos, actualizadaPor = '') =>
  setDoc(
    doc(FIRESTORE, COLECCION_INSIGNIAS_PERSONALIZADAS, id),
    { ...campos, actualizadaPor, actualizadaEn: serverTimestamp() },
    { merge: true }
  );
