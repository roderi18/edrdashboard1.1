import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { COLECCION_GALERIA_DIRECTORES } from 'src/utils/galeria-directores.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA el alta de un director en la galería. Como los demás
// `-apply`: aquí solo vive la escritura que `proponerCambio` ejecuta DESPUÉS de
// haberla registrado en Historial.
// ----------------------------------------------------------------------

export const escribirDirectorDeGaleria = (id, director, creadoPor = '') =>
  setDoc(doc(FIRESTORE, COLECCION_GALERIA_DIRECTORES, id), {
    ...director,
    creadoPor,
    creadoEn: serverTimestamp(),
  });

// Editar: solo los campos que cambian, sin tocar quién lo creó ni cuándo.
export const actualizarDirectorDeGaleria = (id, cambios, actualizadoPor = '') =>
  setDoc(
    doc(FIRESTORE, COLECCION_GALERIA_DIRECTORES, id),
    { ...cambios, actualizadoPor, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
