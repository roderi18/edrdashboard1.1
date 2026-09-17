// ----------------------------------------------------------------------
// LAS CAMPAÑAS: UN BLOQUE DISTINTO DURANTE UNAS FECHAS, Y PARA QUIEN TOQUE
// (fases 7 y 8).
//
// Una campaña es una publicacion con vigencia: "del 1 al 15 de octubre, la
// proxima actividad es la Investidura", y si se quiere, solo para una region o
// unos destacamentos. Mientras esta vigente manda sobre lo publicado; antes de
// empezar y despues de terminar, no existe para la portada. Asi nadie tiene que
// acordarse de publicar a las doce de la noche ni de quitarla despues.
//
// El orden de lo que se pinta en cada bloque es:
//
//   campaña vigente para esa persona → lo publicado → lo de fabrica (el codigo)
//
// Se guardan en el mismo documento que lo publicado (`campanas`), para que la
// portada siga haciendo UNA lectura por visita.
//
// Las fechas son dias de calendario en hora de la Republica Dominicana, como las
// de la proxima actividad: "termina el 15" significa que el 15 aun se ve.
// ----------------------------------------------------------------------

import { bloquePorId } from './bloques.mjs';
import { sanearPublicacion } from './publicacion.mjs';
import { texto, clave, esObjeto, fechaISO } from './saneado.mjs';

export const TIPOS_DE_AUDIENCIA = Object.freeze({
  todos: 'todos',
  regiones: 'regiones',
  destacamentos: 'destacamentos',
});

export const ETIQUETAS_DE_AUDIENCIA = Object.freeze({
  [TIPOS_DE_AUDIENCIA.todos]: 'Toda la organización',
  [TIPOS_DE_AUDIENCIA.regiones]: 'Solo unas regiones',
  [TIPOS_DE_AUDIENCIA.destacamentos]: 'Solo unos destacamentos',
});

export const ESTADOS_DE_CAMPANA = Object.freeze({
  programada: 'programada',
  vigente: 'vigente',
  terminada: 'terminada',
});

export const ETIQUETAS_DE_ESTADO_DE_CAMPANA = Object.freeze({
  [ESTADOS_DE_CAMPANA.programada]: 'Programada',
  [ESTADOS_DE_CAMPANA.vigente]: 'En curso',
  [ESTADOS_DE_CAMPANA.terminada]: 'Terminada',
});

const MAXIMO_DE_IDS_EN_AUDIENCIA = 200;

const idDeEntidad = (valor) => {
  const limpio = String(valor ?? '').trim();

  return /^[\w-]{1,40}$/.test(limpio) ? limpio : null;
};

/** La audiencia limpia, o `null`. Sin audiencia, es para todos. */
export function sanearAudiencia(valor) {
  if (valor === undefined || valor === null) return { tipo: TIPOS_DE_AUDIENCIA.todos };
  if (!esObjeto(valor)) return null;

  if (valor.tipo === TIPOS_DE_AUDIENCIA.todos) return { tipo: TIPOS_DE_AUDIENCIA.todos };

  if (
    valor.tipo !== TIPOS_DE_AUDIENCIA.regiones &&
    valor.tipo !== TIPOS_DE_AUDIENCIA.destacamentos
  ) {
    return null;
  }

  if (!Array.isArray(valor.ids) || !valor.ids.length) return null;
  if (valor.ids.length > MAXIMO_DE_IDS_EN_AUDIENCIA) return null;

  const ids = valor.ids.map(idDeEntidad);

  if (ids.some((id) => id === null)) return null;

  // Los nombres son solo para enseñarlos en el Designer; no deciden nada.
  const nombres = Array.isArray(valor.nombres)
    ? valor.nombres.slice(0, ids.length).map((nombre) => String(nombre ?? '').slice(0, 120))
    : [];

  return { tipo: valor.tipo, ids: [...new Set(ids)], nombres };
}

/**
 * ¿Le llega esta audiencia a esta persona? `quien` es `{ idRegion, idDestacamento }`
 * de la sesion. Si no se sabe su region o su destacamento, una campaña acotada no
 * le llega: mejor ver lo de todos que lo de otra region.
 */
export function alcanzaA(audiencia, quien = {}) {
  if (!audiencia || audiencia.tipo === TIPOS_DE_AUDIENCIA.todos) return true;

  const propio =
    audiencia.tipo === TIPOS_DE_AUDIENCIA.regiones
      ? String(quien?.idRegion ?? '').trim()
      : String(quien?.idDestacamento ?? '').trim();

  return Boolean(propio) && audiencia.ids.includes(propio);
}

/**
 * Una campaña guardada, limpia, o `null` si algo no vale: fechas al reves, un
 * bloque que no existe, un contenido o un diseño roto, una audiencia mal hecha.
 */
export function sanearCampana(valor) {
  if (!esObjeto(valor)) return null;

  const id = clave(valor.id);
  const bloque = bloquePorId(valor.idBloque);
  const nombre = texto(valor.nombre, { max: 80, obligatorio: true });
  const desde = fechaISO(valor.desde);
  const hasta = fechaISO(valor.hasta);
  const audiencia = sanearAudiencia(valor.audiencia);
  const publicacion = bloque ? sanearPublicacion(bloque, valor) : null;

  if (!id || !nombre || !desde || !hasta || hasta < desde || !audiencia || !publicacion) {
    return null;
  }

  return {
    id,
    idBloque: bloque.id,
    nombre,
    desde,
    hasta,
    audiencia,
    contenido: publicacion.contenido,
    diseno: publicacion.diseno,
    creadoEn: typeof valor.creadoEn === 'string' ? valor.creadoEn : '',
    creadoPor: esObjeto(valor.creadoPor) ? valor.creadoPor : null,
  };
}

/** Todas las campañas validas de un documento publicado, sin las rotas. */
export function campanasDe(publicado) {
  const mapa = esObjeto(publicado) && esObjeto(publicado.campanas) ? publicado.campanas : {};

  return Object.values(mapa)
    .map((campana) => {
      try {
        return sanearCampana(campana);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function estadoDeCampana(campana, hoy) {
  if (hoy < campana.desde) return ESTADOS_DE_CAMPANA.programada;
  if (hoy > campana.hasta) return ESTADOS_DE_CAMPANA.terminada;

  return ESTADOS_DE_CAMPANA.vigente;
}

/**
 * La campaña que manda hoy en un bloque para esta persona, o `null`.
 *
 * Si hay dos a la vez, gana la que empezo MAS TARDE —la mas concreta: una
 * semana especial dentro de un mes de campaña—, y a igual inicio, la creada
 * despues.
 */
export function campanaVigente({ campanas = [], idBloque, hoy, quien }) {
  if (!hoy) return null;

  return (
    campanas
      .filter(
        (campana) =>
          campana.idBloque === idBloque &&
          estadoDeCampana(campana, hoy) === ESTADOS_DE_CAMPANA.vigente &&
          alcanzaA(campana.audiencia, quien)
      )
      .sort((a, b) => b.desde.localeCompare(a.desde) || b.creadoEn.localeCompare(a.creadoEn))[0] ??
    null
  );
}

/** Una clave nueva para una campaña. */
export const idDeCampanaNueva = (ahora = new Date()) =>
  `campana-${ahora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Lo que se escribe al programar una campaña, ya limpio y firmado. Lanza con un
 * mensaje claro si algo no vale: el Designer lo enseña y no programa a medias.
 */
export function prepararCampana({
  id,
  idBloque,
  nombre,
  desde,
  hasta,
  audiencia,
  contenido,
  diseno,
  usuario = {},
  ahora = new Date(),
}) {
  const bloque = bloquePorId(idBloque);

  if (!bloque || bloque.externo) {
    throw new Error(`"${idBloque}" no es un bloque que se publique desde el Designer.`);
  }

  if (!texto(nombre, { max: 80, obligatorio: true })) {
    throw new Error('La campaña necesita un nombre (hasta 80 caracteres).');
  }

  if (!fechaISO(desde) || !fechaISO(hasta)) {
    throw new Error('Elige cuándo empieza y cuándo termina la campaña.');
  }

  if (hasta < desde) throw new Error('La campaña no puede terminar antes de empezar.');

  if (!sanearAudiencia(audiencia)) {
    throw new Error('Elige al menos una región o un destacamento para la campaña.');
  }

  const campana = sanearCampana({
    id: id ?? idDeCampanaNueva(ahora),
    idBloque,
    nombre,
    desde,
    hasta,
    audiencia,
    contenido,
    diseno,
    creadoEn: ahora.toISOString(),
    creadoPor: {
      uid: String(usuario?.uid || usuario?.id || ''),
      nombre: String(usuario?.displayName || usuario?.nombre || usuario?.email || ''),
    },
  });

  if (!campana) {
    throw new Error(
      `El contenido o el diseño de "${bloque.nombre}" tiene datos que no son válidos.`
    );
  }

  return campana;
}
