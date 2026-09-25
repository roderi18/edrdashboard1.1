import { _awards } from 'src/_mock/_awards.js';

// ----------------------------------------------------------------------
// CARPETAS DE PREMIOS E INSIGNIAS (Sistema de Ascenso y Academia Ministerial).
//
// Una "carpeta de premios" es la última de cada rama: la que solo tiene premios
// dentro (Premios de Destreza - Verde, un trimestre de las guías, Instructor…).
// Todas se pintan igual —tarjeta de insignia en cuadrícula, check, selección—;
// ver `docs/premios-tarjeta-de-insignia.md`.
//
// La imagen de cada premio vive en `public/sistemaAscenso/<división>/<carpeta>/`
// con el nombre del premio en minúsculas y con guiones ("Ciencias Ambientales" →
// `ciencias-ambientales.webp`). Se busca por NOMBRE y no por número de archivo:
// la numeración antigua no seguía el orden del catálogo y ponía insignias de
// otro premio. Los nombres que no coinciden van en `alias`; los premios sin
// imagen, en `sinImagen`, y sacan el icono del PDF en el mismo hueco.
// Sin imagen posible hoy: Premios Bíblicos (15 insignias numeradas para 24
// libros), guías semanales y Academia Ministerial (esta usa sus iconos propios).
// ----------------------------------------------------------------------

const RAIZ = '/sistemaAscenso';

const SISTEMAS_CON_PREMIOS = new Set(['sistema-de-ascenso', 'academia-ministerial']);

/** "Primeros Auxilios-RCP" → "primeros-auxilios-rcp". */
export const nombreDeArchivo = (nombre) =>
  String(nombre ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// "Biblia-REQUERIDO" → "biblia": las carpetas de requeridos no llevan el sufijo.
const sinRequerido = (base) => base.replace(/-requerido$/, '');

// "Premio de Liderazgo 201" → "premio-de-liderazgo-amarillo-201".
const liderazgoDeColor = (color) => (base) =>
  base.replace(/^premio-de-liderazgo-/, `premio-de-liderazgo-${color}-`);

// Las insignias de los Retos Espirituales, en su orden (el número del archivo).
export const INSIGNIAS_VERDADES_FUNDAMENTALES = [
  '1-azul-claro',
  '2-rojo',
  '3-verde',
  '4-caqui',
  '5-gris',
  '6-amarillo',
];

// "12-palabras-de-consuelo" → la insignia 12 de la secuencia, dando la vuelta:
// el reto 1 lleva la 1, el 6 la 6, el 7 otra vez la 1… Sin número, la primera.
const enCiclo = (insignias) => (base) => {
  const numero = Number(/^(\d+)-/.exec(base)?.[1]) || 1;

  return insignias[(numero - 1) % insignias.length];
};

/**
 * Carpeta del catálogo → dónde están sus imágenes y cómo se llama cada archivo.
 * `archivo(base)` transforma el nombre ya en forma de archivo; `alias` corrige
 * los que se nombraron distinto; `sinImagen`, los premios que no tienen;
 * `imagenCompartida`, que todos los premios de la carpeta llevan la misma.
 */
export const CARPETAS_CON_INSIGNIA = {
  'seguidores__premios-de-destreza-verde': {
    ruta: `${RAIZ}/seguidores-de-la-senda/premios-de-destreza-verde`,
    alias: {
      canoa: 'canoas',
      'cocinando-en-olla-holandesa': 'cocinando-en-ollas-holandesas',
      'hablar-en-publico': 'public-speaking',
      'orientacion-con-brujula': 'orientacion-con-la-brujula',
      'preparacion-en-las-emergencias': 'preparacion-de-las-emergencias',
      'reparaciones-en-el-hogar': 'reparacion-en-el-hogar',
      'seguridad-en-caso-de-incendios': 'seguridad-en-caso-de-incendio',
    },
  },
  'seguidores__premios-requeridos': {
    ruta: `${RAIZ}/seguidores-de-la-senda/premios-de-destreza-verde-requeridos`,
    archivo: sinRequerido,
  },
  'seguidores__premios-de-liderazgo-amarillo': {
    ruta: `${RAIZ}/seguidores-de-la-senda/premios-de-liderazgo-amarillo`,
    archivo: liderazgoDeColor('amarillo'),
  },
  'pioneros__premios-de-destreza-azul': {
    ruta: `${RAIZ}/pioneros/premios-de-destreza-azul`,
  },
  'pioneros__premios-requeridos': {
    ruta: `${RAIZ}/pioneros/premios-de-destreza-azul-requeridos`,
    archivo: sinRequerido,
  },
  'pioneros__premios-de-liderazgo-rojo': {
    ruta: `${RAIZ}/pioneros/premios-de-liderazgo-rojo`,
    archivo: liderazgoDeColor('rojo'),
  },
  'exploradores__premios-de-destreza-plata': {
    ruta: `${RAIZ}/exploradores/premios-de-destreza-platino`,
    alias: {
      'conservacion-del-suelo-y-el-agua': 'conservacion-del-suelo-y-agua',
      'curtido-de-cueros': 'curtidos-de-cuero',
    },
    sinImagen: ['explorador-del-aire'],
  },
  // Retos Espirituales (verdades fundamentales): 6 insignias para 150 retos, en
  // secuencia por el número del reto ("7 …" vuelve a la 1).
  'exploradores__retos-espirituales': {
    ruta: `${RAIZ}/exploradores/verdades-fundamentales`,
    archivo: enCiclo(INSIGNIAS_VERDADES_FUNDAMENTALES),
    imagenCompartida: true,
  },
  'exploradores__premios-requeridos': {
    ruta: `${RAIZ}/exploradores/premios-de-destreza-platino-requeridos`,
    archivo: sinRequerido,
  },
  'exploradores__premios-de-liderazgo-celeste': {
    ruta: `${RAIZ}/exploradores/premios-de-liderazgo-celeste`,
    archivo: liderazgoDeColor('celeste'),
  },
};

/** La ruta pública de la insignia de un premio, o `null` si no tiene. */
export function imagenDeInsignia(idCarpeta, nombrePremio) {
  const carpeta = CARPETAS_CON_INSIGNIA[String(idCarpeta ?? '')];
  const base = nombreDeArchivo(nombrePremio);
  if (!carpeta || !base || carpeta.sinImagen?.includes(base)) return null;

  const archivo = carpeta.alias?.[base] ?? (carpeta.archivo ? carpeta.archivo(base) : base);

  return `${carpeta.ruta}/${archivo}.webp`;
}

// Las carpetas de premios de un árbol, calculadas una vez por árbol.
const carpetasPorArbol = new WeakMap();

const carpetasDePremiosDe = (arbol) => {
  if (carpetasPorArbol.has(arbol)) return carpetasPorArbol.get(arbol);

  const porId = new Map(arbol.map((nodo) => [nodo.id, nodo]));
  const raizDe = (nodo) => {
    let actual = nodo;
    while (actual?.parentId) actual = porId.get(actual.parentId);
    return actual?.id;
  };

  const conHijos = new Map();
  arbol.forEach((nodo) => {
    if (!nodo?.parentId) return;
    const hijos = conHijos.get(nodo.parentId) ?? { carpetas: 0, premios: 0 };
    if (nodo.type === 'folder') hijos.carpetas += 1;
    else hijos.premios += 1;
    conHijos.set(nodo.parentId, hijos);
  });

  const carpetas = new Set(
    [...conHijos]
      .filter(([id, hijos]) => {
        const nodo = porId.get(id);
        return (
          nodo?.type === 'folder' &&
          nodo.parentId &&
          hijos.premios > 0 &&
          hijos.carpetas === 0 &&
          SISTEMAS_CON_PREMIOS.has(raizDe(nodo))
        );
      })
      .map(([id]) => id)
  );

  carpetasPorArbol.set(arbol, carpetas);
  return carpetas;
};

/**
 * ¿Es la carpeta `idCarpeta` una carpeta de premios (la última de su rama, solo
 * con premios dentro, en el Sistema de Ascenso o la Academia Ministerial)?
 */
export const esCarpetaDePremios = (idCarpeta, arbol = _awards) =>
  Boolean(idCarpeta) && carpetasDePremiosDe(Array.isArray(arbol) ? arbol : _awards).has(String(idCarpeta));

/** Todas las carpetas de premios del catálogo (para los tests y la documentación). */
export const todasLasCarpetasDePremios = (arbol = _awards) => [...carpetasDePremiosDe(arbol)];
