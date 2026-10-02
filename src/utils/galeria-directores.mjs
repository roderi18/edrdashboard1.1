// ----------------------------------------------------------------------
// GALERÍA DE DIRECTORES NACIONALES (pestaña de Consejo Nacional).
//
// Cada director es una tarjeta con foto, nombre y año ("2008-2010" o "1998"),
// pintada con el diseño de EXPLORA Designer → Tarjeta. Se ordena del año más
// reciente al más antiguo: los años menores quedan debajo.
//
// HAY QUIEN SIRVIÓ DOS VECES ("2010-2014 / 2018-2022", como en su placa). Cada
// periodo va separado por "/" (también vale ";", "," o " y "), y el director se
// ordena por su periodo MÁS RECIENTE: así sale junto a quienes dirigieron en su
// último mandato. Con el mismo inicio, el que termina después va antes. Se
// guardan en `galeria_directores_nacionales`; los añade solo el Administrador
// Global.
// ----------------------------------------------------------------------

export const COLECCION_GALERIA_DIRECTORES = 'galeria_directores_nacionales';

const MAX_NOMBRE = 80;
// Cabe un texto como "Ex Director Nacional 2010-2014 / 2018-2022". Con 30 se
// cortaba el segundo periodo.
const MAX_ANIO = 80;

const aniosDe = (texto) => (String(texto ?? '').match(/\d{4}/g) || []).map(Number);

/** Los periodos del texto, cada uno con su inicio y su fin (iguales si es un solo año). */
export const periodosDe = (texto) =>
  String(texto ?? '')
    .split(/\s*(?:\/|;|,|\by\b)\s*/i)
    .map(aniosDe)
    .filter((anios) => anios.length)
    .map((anios) => ({ inicio: anios[0], fin: anios[anios.length - 1] }));

/** El periodo que ordena: el más reciente. */
const periodoQueOrdena = (texto) =>
  periodosDe(texto).reduce(
    (elegido, periodo) =>
      periodo.inicio > elegido.inicio ||
      (periodo.inicio === elegido.inicio && periodo.fin > elegido.fin)
        ? periodo
        : elegido,
    { inicio: 0, fin: 0 }
  );

/** El año que ordena (el inicio del periodo más reciente), o 0 si no trae ninguno. */
export const anioDeOrden = (texto) => periodoQueOrdena(texto).inicio;

export function ordenarGaleria(directores = []) {
  return [...directores].sort((a, b) => {
    const pa = periodoQueOrdena(a.anio);
    const pb = periodoQueOrdena(b.anio);

    return (
      pb.inicio - pa.inicio ||
      pb.fin - pa.fin ||
      String(a.nombre).localeCompare(String(b.nombre), 'es')
    );
  });
}

export function validarDirectorNuevo({ nombre, anio, tieneFoto }) {
  if (!String(nombre ?? '').trim()) return 'Escribe el nombre.';
  if (!anioDeOrden(anio)) return 'Escribe el año con cuatro cifras (por ejemplo 2008-2010).';
  if (!tieneFoto) return 'Elige la foto.';
  return '';
}

/** Lo leído de Firestore, o null si no se puede pintar (sin foto https o sin nombre). */
export function directorDesdeDocumento(id, datos = {}) {
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim().slice(0, MAX_NOMBRE) : '';
  const fotoUrl = typeof datos.fotoUrl === 'string' ? datos.fotoUrl : '';

  if (!id || !nombre || !/^https:\/\//.test(fotoUrl)) return null;

  return {
    id: String(id),
    nombre,
    anio: typeof datos.anio === 'string' ? datos.anio.trim().slice(0, MAX_ANIO) : '',
    fotoUrl,
    // El texto de SU barra dorada; vacío = su nombre y su año (`textoDePlaca`).
    placaArriba: texto80(datos.placaArriba),
    placaAbajo: texto80(datos.placaAbajo),
  };
}

const texto80 = (valor) => (typeof valor === 'string' ? valor.trim().slice(0, MAX_ANIO) : '');

/**
 * LA BARRA DORADA ES DE CADA DIRECTOR. El texto escrito en EXPLORA Designer es
 * solo el de muestra: sin esto, todas las tarjetas repetían el de una persona
 * ("Dany Trinidad Feliz" salía también en la de Alejandro Terrero). Cada uno
 * lleva el suyo, y si no se escribió, su nombre arriba y su año abajo.
 */
export const textoDePlaca = ({
  nombre = '',
  anio = '',
  placaArriba = '',
  placaAbajo = '',
} = {}) => ({
  arriba: String(placaArriba || '').trim() || nombre,
  abajo: String(placaAbajo || '').trim() || anio,
});

/**
 * {nombre} y {año} (o {anio}) del texto de una imagen flotante, cambiados por los
 * del director. Sin director (la vista previa del Designer) el texto va tal cual.
 */
export function conTextos(texto, textos) {
  if (!textos) return texto;
  return String(texto ?? '')
    .replace(/\{nombre\}/gi, textos.nombre ?? '')
    .replace(/\{a(?:ñ|n)o\}/gi, textos.anio ?? '');
}

// ----------------------------------------------------------------------
// EL PERIODO DE UN EX DIRECTOR, PARA LA LISTA DE LA DIRECTIVA.
//
// En la columna Posición, "Ex Director Nacional" lleva sus años, sacados de la
// galería. La galería y el padrón no escriben el nombre igual ("Rev. Dany
// Trinidad Feliz" / "Dany Trinidad", "William" / "Wilian", "Domingo A. Amancio"
// / "Domingo Amancio"), así que se casan por palabras: sin acentos, sin títulos
// ni iniciales, y cada palabra del padrón tiene que estar en la galería (igual o
// casi: ver `mismaPalabra`). Si dos fichas de la galería encajan igual de
// bien, no se pone ninguna: mejor sin año que con el de otro.
// ----------------------------------------------------------------------

const TITULOS = new Set(['rev', 'pastor', 'pas', 'dr', 'lic', 'ing', 'sr', 'sra', 'hno', 'prof']);
const UNIONES = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

const palabrasDelNombre = (nombre) =>
  String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-zñ]+/)
    .filter((palabra) => palabra.length > 1 && !TITULOS.has(palabra) && !UNIONES.has(palabra));

/** Cuántas letras hay que cambiar, poner o quitar para pasar de una palabra a otra. */
const distancia = (a, b) => {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];

    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        anterior[j] + 1,
        actual[j - 1] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    anterior = actual;
  }

  return anterior[b.length];
};

/**
 * ¿Es la misma palabra mal escrita? Una letra de diferencia en las cortas, dos en
 * las de seis o más ("Wilian" / "William"). Las de menos de cuatro, exactas.
 */
const mismaPalabra = (a, b) => {
  if (a === b) return true;

  const corta = Math.min(a.length, b.length);

  if (corta < 4) return false;

  return distancia(a, b) <= (corta >= 6 ? 2 : 1);
};

/** Solo los años del texto de la galería ("Ex Director Nacional 2008-2010" → "2008-2010"). */
export const periodoSinCargo = (anio) =>
  String(anio ?? '')
    .replace(/^[^\d]*/, '')
    .trim();

/** El periodo en la galería de la persona con ese nombre, o '' si no se encuentra (o hay duda). */
export function periodoDeDirectorPorNombre(galeria = [], nombre = '') {
  const buscadas = palabrasDelNombre(nombre);

  if (buscadas.length < 2) return '';

  const candidatos = galeria
    .map((director) => {
      const suyas = palabrasDelNombre(director?.nombre);
      const encajan = buscadas.every((palabra) =>
        suyas.some((suya) => mismaPalabra(palabra, suya))
      );

      return encajan ? { director, sobrantes: suyas.length - buscadas.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.sobrantes - b.sobrantes);

  if (!candidatos.length) return '';
  if (candidatos[1] && candidatos[1].sobrantes === candidatos[0].sobrantes) return '';

  return periodoSinCargo(candidatos[0].director.anio);
}
