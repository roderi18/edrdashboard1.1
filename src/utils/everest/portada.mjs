// ----------------------------------------------------------------------
// QUE SE PINTA EN CADA BLOQUE: LO PUBLICADO, O LO DE SIEMPRE.
//
// La promesa de EVEREST Designer es que la portada no cambia hasta que alguien la
// publica. Esta funcion es donde se cumple, y es pura a proposito: sin Firestore
// ni React, se prueba con cualquier documento —vacio, roto o inventado— y siempre
// contesta.
//
// Para cada bloque:
//
//   - Si esta publicado Y su contenido pasa el saneado, se pinta eso.
//   - En cualquier otro caso —no hay documento, no esta ese bloque, el contenido
//     no cuadra, o el saneado revienta— se pinta el valor de fabrica: lo que
//     sale hoy del codigo. Una publicacion rota nunca deja un hueco en la
//     portada; deja lo de antes.
//
// Publicar un bloque no toca los demas: cada uno se resuelve por su cuenta.
// ----------------------------------------------------------------------

import { esObjeto } from './saneado.mjs';
import { bloquePorId, bloquesPublicablesDe } from './bloques.mjs';

export const ORIGEN_DEL_BLOQUE = Object.freeze({
  codigo: 'codigo',
  designer: 'designer',
});

const sanearSinRomper = (bloque, contenido) => {
  try {
    return bloque.sanear(contenido);
  } catch {
    return null;
  }
};

/**
 * @param publicado  Los datos de `everest_publicado/{pantalla}`, o lo que llegue.
 * @param fabrica    `{ idBloque: valor }` con lo que se pinta hoy. Un bloque sin
 *                   valor aqui (el lema) se resuelve a `undefined` y su
 *                   componente usa lo que lleva escrito.
 * @returns `{ idBloque: { origen, contenido, publicadoEn?, publicadoPor? } }`
 */
export function resolverPortada({ publicado, fabrica = {}, pantalla }) {
  const bloquesPublicados =
    esObjeto(publicado) && esObjeto(publicado.bloques) ? publicado.bloques : {};

  return Object.fromEntries(
    bloquesPublicablesDe(pantalla).map((bloque) => {
      const guardado = bloquesPublicados[bloque.id];
      const contenido = esObjeto(guardado) ? sanearSinRomper(bloque, guardado.contenido) : null;

      if (contenido === null) {
        return [bloque.id, { origen: ORIGEN_DEL_BLOQUE.codigo, contenido: fabrica[bloque.id] }];
      }

      return [
        bloque.id,
        {
          origen: ORIGEN_DEL_BLOQUE.designer,
          contenido,
          publicadoEn: typeof guardado.publicadoEn === 'string' ? guardado.publicadoEn : '',
          publicadoPor: esObjeto(guardado.publicadoPor) ? guardado.publicadoPor : null,
        },
      ];
    })
  );
}

/**
 * Lo que se escribe al publicar un bloque, ya limpio y firmado.
 *
 * Lanza si el bloque no existe, es externo o el contenido no pasa el saneado: el
 * Designer tiene que enseñar el error, no publicar a medias.
 */
export function prepararPublicacion({ idBloque, contenido, usuario = {}, ahora = new Date() }) {
  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se publique desde el Designer.`);
  }

  const limpio = sanearSinRomper(bloque, contenido);

  if (limpio === null) {
    throw new Error(`El contenido de "${bloque.nombre}" tiene datos que no son válidos.`);
  }

  return {
    contenido: limpio,
    publicadoEn: ahora.toISOString(),
    publicadoPor: {
      uid: String(usuario?.uid || usuario?.id || ''),
      nombre: String(usuario?.displayName || usuario?.nombre || usuario?.email || ''),
    },
  };
}
