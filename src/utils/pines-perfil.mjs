// ----------------------------------------------------------------------
// PINES DEL PERFIL: CATÁLOGO, ORDEN Y ASIGNACIÓN.
//
// Los terceros de la familia, con las cintas (`cintas-perfil.mjs`) y las
// medallas (`medallas-perfil.mjs`). Se tratan como las medallas: el catálogo es
// la carpeta `public/parches/Cintas y medallas/pines` —una imagen nueva ahí sale
// en la aplicación sin tocar código— más los que el Administrador Global añade
// en EXPLORA Designer, y encima manda el orden global que se arrastra allí.
//
// En el perfil van ENCIMA de las cintas, en una sola fila centrada: como mucho
// tres, cada uno del ancho de una cinta.
//
// La lectura de la carpeta y el orden son los de las medallas (misma forma de
// nombrar los archivos: número inicial = orden de fábrica); aquí solo cambian la
// carpeta, la colección, el documento del orden y el tope.
//
// Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

import {
  ordenarMedallas,
  moverMedallaEnOrden,
  catalogoDesdeArchivos,
  disponerMedallasEnFilas,
  normalizarOrdenDeMedallas,
  catalogoDeMedallasEnOrden,
  esOrdenDeMedallasDeFabrica,
} from './medallas-perfil.mjs';

export const RUTA_PINES = '/parches/Cintas%20y%20medallas/pines';
export const CARPETA_PINES = ['public', 'parches', 'Cintas y medallas', 'pines'];
export const COLECCION_PINES_MIEMBROS = 'pines_miembros';
// Junto al orden de cintas y medallas: la regla de `configuracion_cintas` ya lo cubre.
export const DOCUMENTO_ORDEN_PINES = 'orden-pines';
export const PINES_POR_FILA = 3;
export const MAXIMO_PINES = 3;

/** La lista de archivos de la carpeta de pines → el catálogo. */
export const catalogoDePinesDesdeArchivos = (archivos = []) =>
  catalogoDesdeArchivos(archivos, { ruta: RUTA_PINES });

export const normalizarOrdenDePines = normalizarOrdenDeMedallas;
export const catalogoDePinesEnOrden = catalogoDeMedallasEnOrden;
export const moverPinEnOrden = moverMedallaEnOrden;
export const esOrdenDePinesDeFabrica = esOrdenDeMedallasDeFabrica;

/** Los pines de un miembro, sin repetidos ni desconocidos, en el orden que manda. */
export const ordenarPines = ordenarMedallas;

/** Para el perfil: una fila centrada, como mucho `MAXIMO_PINES`. */
export const disponerPinesEnFilas = (entradas = []) =>
  disponerMedallasEnFilas(entradas, { porFila: PINES_POR_FILA, maximo: MAXIMO_PINES });

/**
 * El documento `pines_miembros/{idMiembros}` al asignar a mano: conserva la fecha
 * de los que ya estaban. `elegidos`: ids sueltos o `{ id }`.
 */
export const construirPinesAsignados = (anteriores = [], elegidos = [], ahoraIso = '') => {
  const previos = new Map(
    (Array.isArray(anteriores) ? anteriores : [])
      .filter((entrada) => entrada && typeof entrada === 'object')
      .map((entrada) => [String(entrada.id), entrada])
  );
  const ids = (Array.isArray(elegidos) ? elegidos : [])
    .map((entrada) => String((entrada && typeof entrada === 'object' ? entrada.id : entrada) ?? ''))
    .filter(Boolean);

  return [...new Set(ids)].map(
    (id) => previos.get(id) ?? { id, origen: 'prueba', asignadaEn: ahoraIso }
  );
};
