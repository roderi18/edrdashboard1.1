import { getDoc } from 'firebase/firestore';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { bloquePorId } from 'src/utils/everest/bloques.mjs';
import { ORIGEN_DEL_BLOQUE, prepararPublicacion } from 'src/utils/everest/portada.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import {
  referenciaDePublicado,
  quitarBloquePublicado,
  escribirBloquePublicado,
} from './everest-apply';

// ----------------------------------------------------------------------
// EVEREST DESIGNER: LEER Y PUBLICAR LA PORTADA.
//
// Lo que se publica aqui lo ve toda la organizacion, asi que pasa por la puerta
// de cambios (`proponerCambio`), igual que la Paleta y los Sonidos: se aplica en
// el acto —lo publica el Administrador Global, no espera a nadie— pero queda en
// Historial quien publico que bloque y cuando.
//
// La comprobacion de rol de aqui es para dar un error claro en pantalla. La que
// de verdad protege es la de `firestore.rules`: solo el Administrador Global
// escribe en `everest_publicado`.
//
// Fase 1: nada de la aplicacion llama todavia a este servicio. Lo usara el
// Designer (fase 3) y la portada lo leera en la fase 2.
// ----------------------------------------------------------------------

const RUTA_DEL_DESIGNER = '/dashboard/admin/everest';

const asegurarPuedePublicar = (usuario) => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }

  if (!isAdminGlobal(usuario)) {
    throw new Error('Solo el Administrador Global publica desde EVEREST Designer.');
  }
};

/**
 * El documento publicado de una pantalla, tal cual, o `null` si no existe.
 *
 * Por defecto tampoco lanza si no se pudo leer: quien lo use pinta el valor de
 * fabrica con un `null`. `lanzarSiFalla` es para quien necesita distinguir "no
 * hay nada publicado" de "no se pudo leer": la portada, que con una red caida no
 * debe tirar la copia buena y volver a lo de fabrica.
 */
export async function obtenerPublicado(pantalla, { lanzarSiFalla = false } = {}) {
  if (!isFirebaseConfigured || !FIRESTORE) return null;

  try {
    const documento = await getDoc(referenciaDePublicado(pantalla));

    return documento.exists() ? documento.data() : null;
  } catch (error) {
    if (lanzarSiFalla) throw error;

    return null;
  }
}

const describirOrigen = (publicado, idBloque) =>
  publicado?.bloques?.[idBloque]
    ? `Publicado el ${publicado.bloques[idBloque].publicadoEn || 'fecha desconocida'}`
    : 'Original del código';

/** Publica un bloque. Devuelve lo escrito, ya limpio y firmado. */
export async function publicarBloque({ pantalla, idBloque, contenido, usuario }) {
  asegurarPuedePublicar(usuario);

  // Lanza si el bloque no existe o el contenido no pasa el saneado: se enseña el
  // error y no se publica a medias.
  const publicacion = prepararPublicacion({ idBloque, contenido, usuario });
  const bloque = bloquePorId(idBloque);
  const anterior = await obtenerPublicado(pantalla);

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'everest_bloque',
      id: `${pantalla}/${idBloque}`,
      nombre: `EVEREST Designer · ${bloque.nombre}`,
      ruta: `${RUTA_DEL_DESIGNER}?bloque=${idBloque}`,
    },
    cambios: [
      {
        campo: idBloque,
        etiqueta: bloque.nombre,
        antes: describirOrigen(anterior, idBloque),
        despues: 'Publicado desde EVEREST Designer',
      },
    ],
    usuario,
    descripcion: `Publicó "${bloque.nombre}" en la pantalla ${pantalla} desde EVEREST Designer.`,
    aplicar: () => escribirBloquePublicado(pantalla, idBloque, publicacion),
  });

  return { ...publicacion, origen: ORIGEN_DEL_BLOQUE.designer };
}

/** Quita lo publicado de un bloque: vuelve a pintarse el del codigo. */
export async function volverBloqueAlOriginal({ pantalla, idBloque, usuario }) {
  asegurarPuedePublicar(usuario);

  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se publique desde el Designer.`);
  }

  const anterior = await obtenerPublicado(pantalla);

  // Ya esta en su original: no hay nada que registrar en Historial.
  if (!anterior?.bloques?.[idBloque]) return;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.everestDesigner,
    entidad: {
      tipo: 'everest_bloque',
      id: `${pantalla}/${idBloque}`,
      nombre: `EVEREST Designer · ${bloque.nombre}`,
      ruta: `${RUTA_DEL_DESIGNER}?bloque=${idBloque}`,
    },
    cambios: [
      {
        campo: idBloque,
        etiqueta: bloque.nombre,
        antes: describirOrigen(anterior, idBloque),
        despues: 'Original del código',
      },
    ],
    usuario,
    descripcion: `Devolvió "${bloque.nombre}" a su diseño original desde EVEREST Designer.`,
    aplicar: () => quitarBloquePublicado(pantalla, idBloque),
  });
}
