// ----------------------------------------------------------------------
// MEDALLAS DEL PERFIL: CATÁLOGO, ORDEN Y ASIGNACIÓN.
//
// Hermanas de las cintas (`cintas-perfil.mjs`), con una diferencia de fondo: el
// catálogo NO está escrito en el código. Es la carpeta
// `public/parches/Cintas y medallas/medallas` tal cual: cualquier imagen que se
// deje ahí aparece en la aplicación (en EXPLORA Designer, en el diálogo para
// asignarlas y en los perfiles). Las subcarpetas ("en proceso") no cuentan.
//
// El id de una medalla es el nombre de su archivo sin extensión. El número del
// principio, si lo tiene, es su orden de fábrica ("1-medalla-al-valor"); las que
// no lo tienen van detrás, por nombre. Encima de eso manda el orden global que el
// Administrador Global arrastra en el Designer.
//
// Sin React ni Firebase, para probarlo con `node --test`.
// ----------------------------------------------------------------------

export const RUTA_MEDALLAS = '/parches/Cintas%20y%20medallas/medallas';
export const CARPETA_MEDALLAS = ['public', 'parches', 'Cintas y medallas', 'medallas'];
export const COLECCION_MEDALLAS_MIEMBROS = 'medallas_miembros';
// Mismo sitio que el orden de las cintas, otro documento: la regla ya existe.
export const DOCUMENTO_ORDEN_MEDALLAS = 'orden-medallas';
// Como mucho TRES en el perfil, en una sola fila justo debajo de las cintas y
// del mismo ancho que una cinta: en el uniforme no caben más.
export const MEDALLAS_POR_FILA = 3;
export const MAXIMO_MEDALLAS = 3;

const EXTENSIONES = /\.(webp|png|jpe?g|gif|avif)$/i;

// ----------------------------------------------------------------------
// EFECTOS: QUE LA MEDALLA NO SE VEA SIEMPRE ESTÁTICA.
//
// Dos ajustes que se combinan, como el brillo de bordes y el de números de las
// cintas: cómo SE MUEVE y cómo BRILLA. Se eligen para cada miembro en el mismo
// diálogo de las cintas (pestaña Medallas) y valen para todas sus medallas; en
// EXPLORA Designer se prueban sobre el catálogo entero.
//
// La imagen se pinta en dos capas —la cinta arriba y el medallón abajo—, así que
// puede moverse la pieza entera, solo el medallón, o la cinta con el medallón
// siguiéndola como si le diera el aire.
// ----------------------------------------------------------------------

export const EFECTOS_MOVIMIENTO_MEDALLA = Object.freeze({
  SOPLO: 'soplo',
  PENDULO: 'pendulo',
  BALANCEO: 'balanceo',
  LATIDO: 'latido',
  NINGUNO: 'ninguno',
});

export const EFECTOS_BRILLO_MEDALLA = Object.freeze({
  DESTELLO: 'destello',
  RESPLANDOR: 'resplandor',
  CENTELLEO: 'centelleo',
  NINGUNO: 'ninguno',
});

// Por defecto se mueven y brillan: es justo lo que se pidió, que no estén quietas.
export const normalizarMovimientoMedalla = (valor) =>
  Object.values(EFECTOS_MOVIMIENTO_MEDALLA).includes(valor)
    ? valor
    : EFECTOS_MOVIMIENTO_MEDALLA.SOPLO;

export const normalizarBrilloMedalla = (valor) =>
  Object.values(EFECTOS_BRILLO_MEDALLA).includes(valor) ? valor : EFECTOS_BRILLO_MEDALLA.DESTELLO;

/** id → { efectoMovimiento, efectoBrillo }, a partir de lo guardado. */
export const configuracionDeMedallas = (entradas = []) =>
  new Map(
    (Array.isArray(entradas) ? entradas : [])
      .map((entrada) => (entrada && typeof entrada === 'object' ? entrada : { id: entrada }))
      .filter((entrada) => entrada.id)
      .map((entrada) => [
        String(entrada.id),
        {
          efectoMovimiento: normalizarMovimientoMedalla(entrada.efectoMovimiento),
          efectoBrillo: normalizarBrilloMedalla(entrada.efectoBrillo),
        },
      ])
  );

/**
 * Un retraso distinto y fijo para cada medalla: con tres a la vez, moviéndose al
 * unísono parecían una sola pieza. Sale del id, así que no cambia al recargar.
 */
export const desfaseDeMedalla = (id = '') =>
  [...String(id)].reduce((suma, letra) => (suma * 31 + letra.charCodeAt(0)) % 997, 7) / 997;

/** "3-medallla-de-oro" → [3, 'medallla-de-oro']; sin número → [Infinity, nombre]. */
const partesDelNombre = (base) => {
  const [, numero, resto] = /^(\d+)[-_ ]+(.+)$/.exec(base) ?? [];

  return numero ? [Number(numero), resto] : [Infinity, base];
};

// "national-leadership-award" → "National leadership award". Los que llevan
// mayúsculas pegadas ("medalOfExcellent") se separan por la mayúscula.
const nombreLegible = (resto) => {
  const texto = resto
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** El orden de fábrica: por número y, sin número o empatadas, por nombre. */
export const compararMedallas = (a, b) =>
  a.numero - b.numero || a.id.localeCompare(b.id, 'es', { numeric: true });

// La variante reducida de una medalla (`DIRECTRICES-MEDALLAS.md`): el mismo
// nombre con `-small`. No es otra medalla; es la que se pinta en el perfil,
// donde la medalla sale pequeña.
const SUFIJO_PEQUENA = /-small$/i;

const rutaDe = (archivo) => `${RUTA_MEDALLAS}/${encodeURIComponent(archivo)}`;

/**
 * La lista de archivos de la carpeta → el catálogo. Solo imágenes; lo demás
 * (un .md, una carpeta) se ignora, y las `-small` van con su medalla.
 */
export const catalogoDesdeArchivos = (archivos = []) => {
  const imagenes = [
    ...new Set(
      (Array.isArray(archivos) ? archivos : [])
        .map((archivo) => String(archivo ?? '').trim())
        .filter((archivo) => EXTENSIONES.test(archivo) && !archivo.includes('/'))
    ),
  ];
  const pequenas = new Map(
    imagenes
      .filter((archivo) => SUFIJO_PEQUENA.test(archivo.replace(EXTENSIONES, '')))
      .map((archivo) => [archivo.replace(EXTENSIONES, '').replace(SUFIJO_PEQUENA, ''), archivo])
  );

  return imagenes
    .filter((archivo) => !SUFIJO_PEQUENA.test(archivo.replace(EXTENSIONES, '')))
    .map((archivo) => {
      const id = archivo.replace(EXTENSIONES, '');
      const [numero, resto] = partesDelNombre(id);
      const pequena = pequenas.get(id);

      return {
        id,
        numero,
        nombre: nombreLegible(resto),
        src: rutaDe(archivo),
        srcPequena: pequena ? rutaDe(pequena) : rutaDe(archivo),
      };
    })
    .sort(compararMedallas);
};

// ----------------------------------------------------------------------
// EL ORDEN GLOBAL (el mismo trato que las cintas).
// ----------------------------------------------------------------------

/** Lista completa y válida: lo guardado que aún existe, y lo nuevo al final. */
export const normalizarOrdenDeMedallas = (orden = [], catalogo = []) => {
  const ids = catalogo.map((medalla) => medalla.id);
  const existentes = new Set(ids);
  const guardados = [
    ...new Set((Array.isArray(orden) ? orden : []).map(String).filter((id) => existentes.has(id))),
  ];

  return [...guardados, ...ids.filter((id) => !guardados.includes(id))];
};

export const catalogoDeMedallasEnOrden = (catalogo = [], orden = null) => {
  if (!Array.isArray(orden) || !orden.length) return [...catalogo];

  const porId = new Map(catalogo.map((medalla) => [medalla.id, medalla]));

  return normalizarOrdenDeMedallas(orden, catalogo).map((id) => porId.get(id));
};

export const moverMedallaEnOrden = (
  orden = [],
  catalogo = [],
  idQueSeMueve = '',
  idDestino = ''
) => {
  const lista = normalizarOrdenDeMedallas(orden, catalogo);
  const desde = lista.indexOf(String(idQueSeMueve));
  const hacia = lista.indexOf(String(idDestino));

  if (desde < 0 || hacia < 0 || desde === hacia) return lista;

  const [movida] = lista.splice(desde, 1);
  lista.splice(hacia, 0, movida);

  return lista;
};

export const esOrdenDeMedallasDeFabrica = (orden = [], catalogo = []) =>
  normalizarOrdenDeMedallas(orden, catalogo).join('|') ===
  catalogo.map((medalla) => medalla.id).join('|');

/**
 * Las medallas de un miembro (ids sueltos o `{ id }`), sin repetidas, sin las
 * que ya no están en la carpeta, en el orden que manda.
 */
export const ordenarMedallas = (entradas = [], catalogo = [], orden = null) => {
  const enOrden = catalogoDeMedallasEnOrden(catalogo, orden).map((medalla) => medalla.id);
  const posicion = new Map(enOrden.map((id, indice) => [id, indice]));
  const ids = (Array.isArray(entradas) ? entradas : [])
    .map((entrada) => String(typeof entrada === 'object' && entrada ? entrada.id : (entrada ?? '')))
    .filter((id) => posicion.has(id));

  return [...new Set(ids)].sort((a, b) => posicion.get(a) - posicion.get(b));
};

/** Filas para el perfil: la incompleta arriba y centrada, como las cintas. */
export const disponerMedallasEnFilas = (
  entradas = [],
  { porFila = MEDALLAS_POR_FILA, maximo = MAXIMO_MEDALLAS } = {}
) => {
  const ids = entradas.slice(0, maximo);
  const sobrante = ids.length % porFila;
  const filas = sobrante ? [ids.slice(0, sobrante)] : [];

  for (let inicio = sobrante; inicio < ids.length; inicio += porFila) {
    filas.push(ids.slice(inicio, inicio + porFila));
  }

  return filas;
};

/**
 * El documento `medallas_miembros/{idMiembros}` al asignar a mano: conserva la
 * fecha de las que ya estaban. `elegidas`: ids sueltos o `{ id, efectoMovimiento,
 * efectoBrillo }`; un efecto que no venga se queda como estaba.
 */
export const construirMedallasAsignadas = (anteriores = [], elegidas = [], ahoraIso = '') => {
  const previas = new Map(
    (Array.isArray(anteriores) ? anteriores : [])
      .filter((entrada) => entrada && typeof entrada === 'object')
      .map((entrada) => [String(entrada.id), entrada])
  );
  const vistas = new Set();

  return (Array.isArray(elegidas) ? elegidas : [])
    .map((entrada) => (entrada && typeof entrada === 'object' ? entrada : { id: entrada }))
    .filter((entrada) => {
      const id = String(entrada.id ?? '');
      if (!id || vistas.has(id)) return false;
      vistas.add(id);
      return true;
    })
    .map((entrada) => {
      const id = String(entrada.id);
      const resultado = { ...(previas.get(id) ?? { id, origen: 'prueba', asignadaEn: ahoraIso }) };

      if (entrada.efectoMovimiento !== undefined) {
        resultado.efectoMovimiento = normalizarMovimientoMedalla(entrada.efectoMovimiento);
      }
      if (entrada.efectoBrillo !== undefined) {
        resultado.efectoBrillo = normalizarBrilloMedalla(entrada.efectoBrillo);
      }

      return resultado;
    });
};
