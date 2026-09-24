// ----------------------------------------------------------------------
// EN QUE ESTA CADA BLOQUE, VISTO DESDE EL DESIGNER.
//
// La lista de la izquierda del Designer dice, para cada bloque, si esta como
// siempre, si ya se publico o si hay cambios a medias. Y la vista previa necesita
// saber QUE pintar: lo que se esta editando, o si aun no se toco nada, lo que esta
// en vivo. Las dos preguntas se contestan aqui, con los mismos datos que usa la
// portada, para que el Designer nunca enseñe algo distinto de lo que veria la
// gente.
//
// UN BORRADOR ROTO NO SE ENSEÑA COMO SI VALIERA. Mientras se escribe, un bloque
// pasa por estados que no se pueden publicar (un titulo vacio, una fecha a
// medias). La vista previa sigue enseñando lo ultimo valido —lo que esta en
// vivo— y el panel avisa de que el borrador todavia no se puede publicar.
// ----------------------------------------------------------------------

import { esObjeto } from './saneado.mjs';
import { bloquePorId, BLOQUES_DEL_DESIGNER } from './bloques.mjs';
import { resolverPortada, ORIGEN_DEL_BLOQUE } from './portada.mjs';
import { DISENO_DE_FABRICA, sanearPublicacion } from './publicacion.mjs';

export const ESTADOS_DEL_BLOQUE = Object.freeze({
  original: 'original',
  publicado: 'publicado',
  borrador: 'borrador',
  externo: 'externo',
});

export const ETIQUETAS_DEL_ESTADO = Object.freeze({
  [ESTADOS_DEL_BLOQUE.original]: 'Original',
  [ESTADOS_DEL_BLOQUE.publicado]: 'Publicado',
  [ESTADOS_DEL_BLOQUE.borrador]: 'Borrador sin publicar',
  [ESTADOS_DEL_BLOQUE.externo]: 'Editor propio',
});

/**
 * @param idBloque    El bloque que se quiere mirar.
 * @param publicado   `everest_publicado/{pantalla}`, o lo que llegue.
 * @param borradores  `everest_borradores/{pantalla}`, o lo que llegue.
 * @param fabrica     `{ idBloque: valor }`, lo mismo que usa la portada.
 */
export function estadoDelBloque({ idBloque, publicado, borradores, fabrica = {} }) {
  const bloque = bloquePorId(idBloque);

  if (!bloque) return null;

  if (bloque.externo) {
    return {
      idBloque,
      estado: ESTADOS_DEL_BLOQUE.externo,
      enVivo: null,
      borrador: null,
      contenidoDeLaVistaPrevia: null,
      disenoDeLaVistaPrevia: DISENO_DE_FABRICA,
    };
  }

  const enVivo = resolverPortada({ publicado, fabrica, pantalla: bloque.pantalla })[idBloque];
  const guardado =
    esObjeto(borradores) && esObjeto(borradores.bloques) && esObjeto(borradores.bloques[idBloque])
      ? borradores.bloques[idBloque]
      : null;
  // Contenido y diseño se validan juntos: un borrador con el diseño roto tampoco
  // se puede publicar ni enseñar.
  const borradorLimpio = guardado ? sanearPublicacion(bloque, guardado) : null;

  let estado = ESTADOS_DEL_BLOQUE.original;

  if (guardado) {
    estado = ESTADOS_DEL_BLOQUE.borrador;
  } else if (enVivo.origen === ORIGEN_DEL_BLOQUE.designer) {
    estado = ESTADOS_DEL_BLOQUE.publicado;
  }

  return {
    idBloque,
    estado,
    enVivo,
    borrador: guardado
      ? {
          contenido: guardado.contenido,
          diseno: esObjeto(guardado.diseno) ? guardado.diseno : {},
          guardadoEn: typeof guardado.guardadoEn === 'string' ? guardado.guardadoEn : '',
          guardadoPor: esObjeto(guardado.guardadoPor) ? guardado.guardadoPor : null,
          valido: borradorLimpio !== null,
        }
      : null,
    contenidoDeLaVistaPrevia: borradorLimpio ? borradorLimpio.contenido : enVivo.contenido,
    disenoDeLaVistaPrevia: borradorLimpio ? borradorLimpio.diseno : enVivo.diseno,
  };
}

/** El estado de todos los bloques, en el orden del registro. */
export const estadosDeLosBloques = ({ publicado, borradores, fabrica }) =>
  BLOQUES_DEL_DESIGNER.map((bloque) =>
    estadoDelBloque({ idBloque: bloque.id, publicado, borradores, fabrica })
  );

/**
 * A donde vuelve el boton "Volver" cuando se llego desde un lapiz.
 *
 * Solo una ruta de la propia aplicacion: `volver` viene en la direccion, y
 * cualquiera puede mandar un enlace al Designer con `volver=https://otro-sitio`.
 */
export const destinoDeVuelta = (volver) =>
  typeof volver === 'string' &&
  volver.startsWith('/') &&
  !volver.startsWith('//') &&
  !volver.includes('\\') &&
  !/\s/.test(volver)
    ? volver
    : '';
