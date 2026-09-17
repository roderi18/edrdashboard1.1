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
//
// CADA BLOQUE TRAE SU CONTENIDO Y SU DISEÑO (`diseno.mjs`). Lo de fabrica lleva
// un diseño vacio, que se pinta como hoy. Un diseño publicado que no pasa el
// saneado tumba el bloque entero a lo de fabrica, igual que un contenido roto:
// medio bloque publicado seria algo que nadie vio al editar.
// ----------------------------------------------------------------------

import { esObjeto } from './saneado.mjs';
import { campanasDe, campanaVigente } from './campanas.mjs';
import { bloquePorId, bloquesPublicablesDe } from './bloques.mjs';
import { DISENO_DE_FABRICA, sanearPublicacion } from './publicacion.mjs';

export { DISENO_DE_FABRICA, sanearPublicacion };

export const ORIGEN_DEL_BLOQUE = Object.freeze({
  codigo: 'codigo',
  designer: 'designer',
  campana: 'campana',
});

/**
 * @param publicado  Los datos de `everest_publicado/{pantalla}`, o lo que llegue.
 * @param fabrica    `{ idBloque: valor }` con lo que se pinta hoy. Un bloque sin
 *                   valor aqui (el lema) se resuelve a `undefined` y su
 *                   componente usa lo que lleva escrito.
 * @param hoy        `AAAA-MM-DD` de hoy. Solo con el se miran las campañas: el
 *                   Designer resuelve sin el para enseñar lo publicado para todos.
 * @param quien      `{ idRegion, idDestacamento }` de la sesion, para las campañas
 *                   que solo van a una parte de la organizacion.
 * @returns `{ idBloque: { origen, contenido, diseno, publicadoEn?, publicadoPor?, idCampana? } }`
 */
export function resolverPortada({ publicado, fabrica = {}, pantalla, hoy, quien }) {
  const bloquesPublicados =
    esObjeto(publicado) && esObjeto(publicado.bloques) ? publicado.bloques : {};
  const campanas = hoy ? campanasDe(publicado) : [];

  return Object.fromEntries(
    bloquesPublicablesDe(pantalla).map((bloque) => {
      // Primero, una campaña vigente para esta persona.
      const campana = campanaVigente({ campanas, idBloque: bloque.id, hoy, quien });

      if (campana) {
        return [
          bloque.id,
          {
            origen: ORIGEN_DEL_BLOQUE.campana,
            contenido: campana.contenido,
            diseno: campana.diseno,
            idCampana: campana.id,
            nombreCampana: campana.nombre,
          },
        ];
      }

      const guardado = bloquesPublicados[bloque.id];
      const limpio = esObjeto(guardado) ? sanearPublicacion(bloque, guardado) : null;

      if (limpio === null) {
        return [
          bloque.id,
          {
            origen: ORIGEN_DEL_BLOQUE.codigo,
            contenido: fabrica[bloque.id],
            diseno: DISENO_DE_FABRICA,
          },
        ];
      }

      return [
        bloque.id,
        {
          origen: ORIGEN_DEL_BLOQUE.designer,
          contenido: limpio.contenido,
          diseno: limpio.diseno,
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
export function prepararPublicacion({
  idBloque,
  contenido,
  diseno,
  usuario = {},
  ahora = new Date(),
}) {
  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se publique desde el Designer.`);
  }

  const limpio = sanearPublicacion(bloque, { contenido, diseno });

  if (limpio === null) {
    throw new Error(
      `El contenido o el diseño de "${bloque.nombre}" tiene datos que no son válidos.`
    );
  }

  return {
    contenido: limpio.contenido,
    diseno: limpio.diseno,
    publicadoEn: ahora.toISOString(),
    publicadoPor: {
      uid: String(usuario?.uid || usuario?.id || ''),
      nombre: String(usuario?.displayName || usuario?.nombre || usuario?.email || ''),
    },
  };
}
