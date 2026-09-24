import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  FieldPath,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { bloquePorId } from 'src/utils/everest/bloques.mjs';
import { COLECCIONES_EXPLORA } from 'src/utils/everest/colecciones.mjs';
import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------
// LOS BORRADORES DE EXPLORA DESIGNER.
//
// Lo que se esta editando y todavia no se publico. No lo ve nadie mas que quien
// edita —las reglas solo dejan al Administrador Global—, y por eso NO pasa por la
// puerta de cambios: un borrador no es un cambio de nada que vea la organizacion,
// y registrar cada autoguardado llenaria Historial de pulsaciones. Lo que queda
// en Historial es la publicacion (`everest-service.js`).
//
// Se guarda en el servidor y no en el navegador para no perder lo escrito al
// cambiar de equipo o al cerrar la pestaña sin publicar.
// ----------------------------------------------------------------------

const referenciaDeBorradores = (pantalla) =>
  doc(FIRESTORE, COLECCIONES_EXPLORA.borradores, pantalla);

const asegurar = (usuario) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global edita en EXPLORA Designer.');
  }
};

const asegurarBloque = (idBloque) => {
  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se edite en el Designer.`);
  }

  return bloque;
};

/**
 * Los borradores de una pantalla, o `null` si no hay. LANZA si no se pudo leer:
 * el Designer tiene que decirlo, no enseñar la pantalla como si no hubiera nada
 * a medias.
 */
async function obtenerBorradoresSinCache(pantalla) {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  const documento = await getDoc(referenciaDeBorradores(pantalla));

  return documento.exists() ? documento.data() : null;
}

/**
 * Guarda lo que se esta editando de un bloque. No se sanea —un borrador puede
 * estar a medias—, pero si se deja en algo que Firestore acepte: sin `undefined`
 * ni funciones.
 */
async function guardarBorradorDeBloqueDirecto({
  pantalla,
  idBloque,
  contenido,
  diseno = {},
  usuario,
}) {
  asegurar(usuario);
  asegurarBloque(idBloque);

  const guardadoEn = new Date().toISOString();

  await setDoc(
    referenciaDeBorradores(pantalla),
    {
      bloques: {
        [idBloque]: {
          contenido: JSON.parse(JSON.stringify(contenido ?? null)),
          diseno: JSON.parse(JSON.stringify(diseno ?? {})),
          guardadoEn,
          guardadoPor: {
            uid: String(usuario?.uid || usuario?.id || ''),
            nombre: String(usuario?.displayName || usuario?.nombre || usuario?.email || ''),
          },
        },
      },
      actualizadoEn: serverTimestamp(),
    },
    // Los borradores de los demas bloques se quedan como estaban.
    { merge: true }
  );

  return guardadoEn;
}

/** Tira lo que se estaba editando de un bloque. Lo publicado no se toca. */
async function descartarBorradorDeBloqueDirecto({ pantalla, idBloque, usuario }) {
  asegurar(usuario);
  asegurarBloque(idBloque);

  const referencia = referenciaDeBorradores(pantalla);

  if (!(await getDoc(referencia)).exists()) return;

  await updateDoc(
    referencia,
    new FieldPath('bloques', idBloque),
    deleteField(),
    'actualizadoEn',
    serverTimestamp()
  );
}

// ----------------------------------------------------------------------
// CACHÉ DE LECTURAS (`src/utils/cache-de-lecturas.mjs`): lo leído se reparte
// desde la memoria de la pestaña y cada escritura lo invalida. Antes cada
// visita a la pantalla volvía a pedirlo todo. Vive solo en memoria: se pierde
// al cerrar la aplicación, también lo sensible (salud, tutores).
// ----------------------------------------------------------------------

export const obtenerBorradores = conCache('everest-borradores:obtenerBorradores', obtenerBorradoresSinCache);
export const guardarBorradorDeBloque = conInvalidacion(guardarBorradorDeBloqueDirecto, ['everest-borradores:']);
export const descartarBorradorDeBloque = conInvalidacion(descartarBorradorDeBloqueDirecto, ['everest-borradores:']);
