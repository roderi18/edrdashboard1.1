import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  FieldPath,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';

import { COLECCIONES_EVEREST } from 'src/utils/everest/colecciones.mjs';

import { FIRESTORE } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// EL BRAZO QUE APLICA lo que se publica en EVEREST Designer.
//
// Mismo caso que `sonidos-apply.js`: aqui solo viven las escrituras que
// `proponerCambio` ejecuta DESPUES de haberlas registrado en Historial. No es
// una puerta paralela; la regla de ESLint mira la sintaxis y no puede
// distinguirlo.
// ----------------------------------------------------------------------

export const referenciaDePublicado = (pantalla) =>
  doc(FIRESTORE, COLECCIONES_EVEREST.publicado, pantalla);

/**
 * Escribe UN bloque dentro del documento de su pantalla.
 *
 * `merge` mezcla los mapas por dentro: los demas bloques publicados se quedan
 * como estaban. Sin el, publicar "Comunicados" borraria "Próxima actividad".
 */
export const escribirBloquePublicado = (pantalla, idBloque, publicacion) =>
  setDoc(
    referenciaDePublicado(pantalla),
    { bloques: { [idBloque]: publicacion }, actualizadoEn: serverTimestamp() },
    { merge: true }
  );

/**
 * Quita un bloque del documento publicado: la portada vuelve a pintar el suyo de
 * siempre, el del codigo.
 *
 * La ruta del campo va con `FieldPath` y no con un texto con puntos: los ids
 * llevan guiones ("proxima-actividad") y asi no hay nada que escapar.
 */
export const quitarBloquePublicado = async (pantalla, idBloque) => {
  const referencia = referenciaDePublicado(pantalla);

  // `updateDoc` falla si el documento no existe; sin documento, el bloque ya
  // esta en su valor de fabrica y no hay nada que quitar.
  if (!(await getDoc(referencia)).exists()) return;

  await updateDoc(
    referencia,
    new FieldPath('bloques', idBloque),
    deleteField(),
    'actualizadoEn',
    serverTimestamp()
  );
};
