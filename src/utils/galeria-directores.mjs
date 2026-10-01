// ----------------------------------------------------------------------
// GALERÍA DE DIRECTORES NACIONALES (pestaña de Consejo Nacional).
//
// Cada director es una tarjeta con foto, nombre y año ("2008-2010" o "1998"),
// pintada con el diseño de EXPLORA Designer → Tarjeta. Se ordena del año más
// reciente al más antiguo: los años menores quedan debajo. Manda el PRIMER año
// del texto (el inicio del periodo); con el mismo inicio, el que termina después
// va antes. Se guardan en `galeria_directores_nacionales`; los añade solo el
// Administrador Global.
// ----------------------------------------------------------------------

export const COLECCION_GALERIA_DIRECTORES = 'galeria_directores_nacionales';

const MAX_NOMBRE = 80;
const MAX_ANIO = 30;

const aniosDe = (texto) => (String(texto ?? '').match(/\d{4}/g) || []).map(Number);

/** El año que ordena (el inicio del periodo), o 0 si no trae ninguno. */
export const anioDeOrden = (texto) => aniosDe(texto)[0] ?? 0;

export function ordenarGaleria(directores = []) {
  return [...directores].sort((a, b) => {
    const [inicioA = 0, ...restoA] = aniosDe(a.anio);
    const [inicioB = 0, ...restoB] = aniosDe(b.anio);
    const finA = restoA.length ? restoA[restoA.length - 1] : inicioA;
    const finB = restoB.length ? restoB[restoB.length - 1] : inicioB;

    return (
      inicioB - inicioA || finB - finA || String(a.nombre).localeCompare(String(b.nombre), 'es')
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
  };
}

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
