import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  FieldPath,
  collection,
  writeBatch,
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
//
// Desde la fase 5 cada escritura va en un LOTE con su version: o quedan las dos,
// o ninguna. Una publicacion sin version no se podria deshacer, y una version
// sin publicacion diria que estuvo en vivo algo que nunca se vio.
// ----------------------------------------------------------------------

export const referenciaDePublicado = (pantalla) =>
  doc(FIRESTORE, COLECCIONES_EVEREST.publicado, pantalla);

// Id nuevo en cada version: una version no se reescribe nunca.
const referenciaDeVersionNueva = () => doc(collection(FIRESTORE, COLECCIONES_EVEREST.versiones));

/**
 * Escribe UN bloque dentro del documento de su pantalla.
 *
 * `merge` mezcla los mapas por dentro: los demas bloques publicados se quedan
 * como estaban. Sin el, publicar "Comunicados" borraria "Próxima actividad".
 */
export const escribirBloquePublicado = (pantalla, idBloque, publicacion, version) => {
  const lote = writeBatch(FIRESTORE);

  lote.set(
    referenciaDePublicado(pantalla),
    { bloques: { [idBloque]: publicacion }, actualizadoEn: serverTimestamp() },
    { merge: true }
  );
  lote.set(referenciaDeVersionNueva(), version);

  return lote.commit();
};

/**
 * Quita un bloque del documento publicado: la portada vuelve a pintar el suyo de
 * siempre, el del codigo.
 *
 * La ruta del campo va con `FieldPath` y no con un texto con puntos: los ids
 * llevan guiones ("proxima-actividad") y asi no hay nada que escapar.
 */
export const quitarBloquePublicado = async (pantalla, idBloque, version) => {
  const referencia = referenciaDePublicado(pantalla);

  // `update` falla si el documento no existe; sin documento, el bloque ya esta
  // en su valor de fabrica y no hay nada que quitar.
  if (!(await getDoc(referencia)).exists()) return;

  const lote = writeBatch(FIRESTORE);

  lote.update(
    referencia,
    new FieldPath('bloques', idBloque),
    deleteField(),
    'actualizadoEn',
    serverTimestamp()
  );
  lote.set(referenciaDeVersionNueva(), version);

  await lote.commit();
};

/**
 * Programa (o reescribe) una campaña. Va en el mismo documento que lo publicado,
 * en `campanas`, para que la portada siga leyendo una sola vez. `merge` deja las
 * demas campañas y los bloques como estaban.
 */
export const escribirCampana = (pantalla, campana) =>
  setDoc(
    referenciaDePublicado(pantalla),
    { campanas: { [campana.id]: campana }, actualizadoEn: serverTimestamp() },
    { merge: true }
  );

/** Quita una campaña: su bloque vuelve a lo publicado, o a lo de fabrica. */
export const quitarCampana = async (pantalla, idCampana) => {
  const referencia = referenciaDePublicado(pantalla);

  if (!(await getDoc(referencia)).exists()) return;

  await updateDoc(
    referencia,
    new FieldPath('campanas', idCampana),
    deleteField(),
    'actualizadoEn',
    serverTimestamp()
  );
};
