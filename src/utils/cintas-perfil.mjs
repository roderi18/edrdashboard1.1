// ----------------------------------------------------------------------
// CINTAS DEL PERFIL: CATÁLOGO, ORDEN Y FILAS.
//
// Cada cinta es un WebP de `public/parches/Cintas y medallas/cintas-perfil` y el
// prefijo del archivo ES su orden oficial. Se guarda solo ese prefijo ('3',
// '12a'): si mañana se renombra el resto del archivo, lo ya asignado no se rompe.
//
// Orden y disposición (manual de líderes, pág. 21, con la lectura acordada):
// se leen como un libro —izquierda a derecha, arriba abajo—, 3 por fila, y la
// fila incompleta va ARRIBA. Con 3, 8, 14, 20, 25: arriba [3][8], abajo
// [14][20][25]. Ordenar por el nombre del archivo ponía la 10 antes que la 2.
//
// Sin React ni Firebase para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

import { TEXTOS_CINTAS_PERFIL } from './cintas-perfil-textos.mjs';

export const RUTA_CINTAS_PERFIL = '/parches/Cintas%20y%20medallas/cintas-perfil';
export const COLECCION_CINTAS_MIEMBROS = 'cintas_miembros';
export const CINTAS_POR_FILA = 3;
export const MAXIMO_CINTAS_VISIBLES = 18;

export const EFECTOS_BORDE_CINTA = Object.freeze({
  BARRIDO: 'barrido',
  OLA: 'ola',
  PULSO: 'pulso',
  CENTELLEO: 'centelleo',
  NINGUNO: 'ninguno',
});

export const EFECTOS_NUMERO_CINTA = Object.freeze({
  BARRIDO: 'barrido',
  DESTELLO: 'destello',
  AURA: 'aura',
  CENTELLEO: 'centelleo',
  NINGUNO: 'ninguno',
});

export const normalizarEfectoBorde = (valor) =>
  Object.values(EFECTOS_BORDE_CINTA).includes(valor)
    ? valor
    : EFECTOS_BORDE_CINTA.BARRIDO;

export const normalizarEfectoNumero = (valor) =>
  Object.values(EFECTOS_NUMERO_CINTA).includes(valor)
    ? valor
    : EFECTOS_NUMERO_CINTA.BARRIDO;

// De dónde salió la cinta. 'prueba' la pone a mano el Administrador Global;
// 'award' queda para cuando se conecte cada award con su cinta.
export const ORIGEN_CINTA = Object.freeze({ PRUEBA: 'prueba', AWARD: 'award' });

// No hay cinta 9: el catálogo refleja la carpeta tal cual.
const ARCHIVOS = [
  '1-cinta-al-valor',
  '2-cinta-de-valentia',
  '3-cinta-de-oro-al-logro-de-honor',
  '4-cinta-senda-del-sable',
  '5-cinta-historica-de-oro-al-logro-mol',
  '6-cinta-al-premio-de-liderazgo-global',
  '7-cinta-al-merito-nacional',
  '8-cinta-a-la-excelencia',
  '10-cinta-directiva-ejecutiva-nacional-nivel-1',
  '11-cinta-directiva-regional-nivel-2',
  '12a-cinta-de-reconocimiento-al-liderazgo-nacional',
  '12b-cinta-de-proyectos-misioneros',
  '13-historica-cinta-estrella-dorada-para-lideres',
  '14-cinta-de-servicio-destacado',
  '15-cinta-directiva-ejecutiva-distrital-nivel-3',
  '16-cinta-directiva-seccional-nivel-4',
  '17-historica-cinta-del-aguila-plateada-o-racimo-plateado',
  '18-historica-cinta-del-racimo-dorado-o-racimo-azul',
  '19-cinta-y-medalla-para-el-pastor',
  '20-cinta-para-el-coordinador-de-destacamento',
  '21-cinta-para-el-lider-de-grupo',
  '22-cinta-de-servicio-del-destacamento',
  '23-cinta-del-curso-de-adiestramiento-para-lideres-cal',
  '24-historica-medalla-de-oro-al-logro-para-lideres',
  '25-cinta-del-servicio-de-los-lideres-juveniles',
  '26-cinta-roja-y-gris',
  '27-cinta-de-talleres-practicos-de-aprendizaje-continuo',
  '28-cinta-de-talleres-teoricos-de-aprendizaje-continuo',
  '29-cinta-al-logro-de-exploradores',
  '30-cinta-al-logro-de-seguidores-de-la-senda',
  '31-cinta-al-logro-de-pioneros',
  '32-cinta-al-logro-de-navegantes',
  '33-cinta-azul',
  '34-cinta-roja',
  '35-cinta-verde',
  '36-cinta-amarilla',
  '37-cinta-plateada',
  '38-cinta-celeste',
  '39-cinta-naranja',
  '40-cinta-marron',
];

// '12a' → [12, 'a']. Número primero y letra después: la 12a va antes que la 12b
// y las dos entre la 11 y la 13.
const claveDeOrden = (id) => {
  const [, numero = '', letra = ''] = /^(\d+)([a-z]*)$/i.exec(String(id ?? '').trim()) ?? [];
  return [Number(numero), letra.toLowerCase()];
};

export const compararCintas = (a, b) => {
  const [numeroA, letraA] = claveDeOrden(a);
  const [numeroB, letraB] = claveDeOrden(b);
  return numeroA - numeroB || letraA.localeCompare(letraB);
};

const nombreDesdeArchivo = (resto) => {
  const texto = resto.replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const CATALOGO_CINTAS_PERFIL = Object.freeze(
  ARCHIVOS.map((archivo) => {
    const [, id, resto] = /^(\d+[a-z]?)-(.+)$/i.exec(archivo);
    return Object.freeze({
      id,
      nombre: TEXTOS_CINTAS_PERFIL[id]?.nombre ?? nombreDesdeArchivo(resto),
      descripcion: TEXTOS_CINTAS_PERFIL[id]?.descripcion ?? '',
      src: `${RUTA_CINTAS_PERFIL}/${archivo}.webp`,
    });
  }).sort((a, b) => compararCintas(a.id, b.id))
);

const POR_ID = new Map(CATALOGO_CINTAS_PERFIL.map((cinta) => [cinta.id, cinta]));

export const obtenerCintaPerfil = (id) =>
  POR_ID.get(
    String(id ?? '')
      .trim()
      .toLowerCase()
  ) ?? null;

// Lo que venga de Firestore (ids sueltos o `{ id, ... }`) → ids del catálogo, sin
// repetidos, en orden oficial. Un id que ya no existe se descarta en vez de
// pintar una imagen rota.
export const ordenarCintas = (entradas = []) => {
  const ids = (Array.isArray(entradas) ? entradas : [])
    .map((entrada) => (typeof entrada === 'object' && entrada ? entrada.id : entrada))
    .map((id) => obtenerCintaPerfil(id)?.id)
    .filter(Boolean);

  return [...new Set(ids)].sort(compararCintas);
};

// Filas de arriba abajo. La primera (arriba) se lleva el sobrante; las demás
// van completas. Se toman las primeras 18 en orden oficial.
export const disponerCintasEnFilas = (
  entradas = [],
  { porFila = CINTAS_POR_FILA, maximo = MAXIMO_CINTAS_VISIBLES } = {}
) => {
  const ids = ordenarCintas(entradas).slice(0, maximo);
  const sobrante = ids.length % porFila;
  const filas = sobrante ? [ids.slice(0, sobrante)] : [];

  for (let inicio = sobrante; inicio < ids.length; inicio += porFila) {
    filas.push(ids.slice(inicio, inicio + porFila));
  }

  return filas;
};

// VECES QUE SE GANÓ UNA CINTA.
//
// Una cinta se lleva una sola vez en el uniforme; si el premio se ganó más de
// una vez, se le pone encima el número en dorado (`numeros-cintas`). Con 1 no
// se pone número. Es el mismo dato que usarán los awards y adiestramientos que
// cuentan cuántas veces se completaron: sale de aquí, no de cada pantalla.
export const RUTA_NUMEROS_CINTAS = '/parches/Cintas%20y%20medallas/numeros-cintas';
export const MAXIMO_VECES_CINTA = 99;

export const normalizarVeces = (valor) => {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero) || numero < 1) return 1;
  return Math.min(numero, MAXIMO_VECES_CINTA);
};

// id → veces, a partir de lo guardado. Una entrada sin `veces` (las de antes)
// cuenta como 1.
export const vecesPorCinta = (entradas = []) => {
  const mapa = new Map();
  (Array.isArray(entradas) ? entradas : []).forEach((entrada) => {
    const esObjeto = typeof entrada === 'object' && entrada;
    const id = obtenerCintaPerfil(esObjeto ? entrada.id : entrada)?.id;
    if (!id) return;
    const veces = esObjeto ? normalizarVeces(entrada.veces) : 1;
    mapa.set(id, Math.max(mapa.get(id) ?? 0, veces));
  });
  return mapa;
};

// La configuración visual se guarda junto con cada cinta. Las entradas antiguas
// siguen usando los dos barridos originales como valores predeterminados.
export const configuracionPorCinta = (entradas = []) => {
  const veces = vecesPorCinta(entradas);
  const entradasPorId = new Map(
    (Array.isArray(entradas) ? entradas : [])
      .filter((entrada) => entrada && typeof entrada === 'object')
      .map((entrada) => [obtenerCintaPerfil(entrada.id)?.id, entrada])
      .filter(([id]) => id)
  );

  return new Map(
    [...veces].map(([id, cantidad]) => {
      const entrada = entradasPorId.get(id) ?? {};
      return [
        id,
        {
          veces: cantidad,
          efectoBorde: normalizarEfectoBorde(entrada.efectoBorde),
          efectoNumero: normalizarEfectoNumero(entrada.efectoNumero),
        },
      ];
    })
  );
};

// Imágenes de los dígitos a poner sobre la cinta, de izquierda a derecha.
// Vacío con 1: una cinta ganada una vez no lleva número.
export const digitosDeVeces = (veces) => {
  const numero = normalizarVeces(veces);
  if (numero < 2) return [];
  return String(numero)
    .split('')
    .map((digito) => `${RUTA_NUMEROS_CINTAS}/numero-${digito}-dorado.webp`);
};

// Documento `cintas_miembros/{idMiembros}` que se guarda al asignar a mano.
// `elegidas`: ids sueltos o `{ id, veces }`. Conserva el origen y la fecha de
// las que ya estaban y actualiza sus veces.
export const construirCintasAsignadas = (anteriores = [], elegidas = [], ahoraIso = '') => {
  const previas = new Map(
    (Array.isArray(anteriores) ? anteriores : [])
      .filter((entrada) => entrada && typeof entrada === 'object')
      .map((entrada) => [String(entrada.id), entrada])
  );
  const veces = vecesPorCinta(elegidas);
  const configuracionesElegidas = new Map(
    (Array.isArray(elegidas) ? elegidas : [])
      .filter((entrada) => entrada && typeof entrada === 'object')
      .map((entrada) => [obtenerCintaPerfil(entrada.id)?.id, entrada])
      .filter(([id]) => id)
  );

  return ordenarCintas(elegidas).map((id) => {
    const previa = previas.get(id);
    const elegida = configuracionesElegidas.get(id);
    const resultado = {
      ...(previa ?? { id, origen: ORIGEN_CINTA.PRUEBA, asignadaEn: ahoraIso }),
      veces: veces.get(id) ?? 1,
    };

    if (elegida?.efectoBorde !== undefined || previa?.efectoBorde !== undefined) {
      resultado.efectoBorde = normalizarEfectoBorde(
        elegida?.efectoBorde ?? previa?.efectoBorde
      );
    }
    if (elegida?.efectoNumero !== undefined || previa?.efectoNumero !== undefined) {
      resultado.efectoNumero = normalizarEfectoNumero(
        elegida?.efectoNumero ?? previa?.efectoNumero
      );
    }

    return resultado;
  });
};
