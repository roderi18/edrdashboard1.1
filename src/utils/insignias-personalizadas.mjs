// ----------------------------------------------------------------------
// CINTAS Y MEDALLAS AÑADIDAS DESDE EXPLORA DESIGNER.
//
// Las de fábrica salen de `public/parches/Cintas y medallas/`: para sumar una
// había que dejar la imagen en la carpeta y, en las cintas, además tocar código,
// y en producción nadie puede escribir en esa carpeta. Estas otras las añade el
// Administrador Global desde el Designer con su imagen, nombre y descripción: la
// imagen va a Storage (`everest/insignias-{tipo}/`) y la ficha a Firestore
// (`insignias_personalizadas/{id}`). Se suman al catálogo de fábrica, detrás de
// todas, y se ordenan y se asignan igual que las demás.
//
// Sin React ni Firebase para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

export const COLECCION_INSIGNIAS_PERSONALIZADAS = 'insignias_personalizadas';

export const TIPOS_INSIGNIA = Object.freeze({ CINTA: 'cinta', MEDALLA: 'medalla' });

export const MAXIMO_NOMBRE_INSIGNIA = 80;
export const MAXIMO_DESCRIPCION_INSIGNIA = 600;

// Solo imágenes de NUESTRO Storage: una ficha con otra dirección se descarta en
// vez de pintar lo que alguien haya puesto ahí.
const ES_URL_DE_STORAGE =
  /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/everest%2Finsignias-/;

const limpiar = (valor, maximo) =>
  String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);

/**
 * El id de una insignia nueva. Las cintas lo necesitan con la forma "letra +
 * número" (`p1737000000000`): así `compararCintas` las pone detrás de las de
 * fábrica (la 40, la a5, las z…) y, entre ellas, por fecha de alta. Las medallas
 * usan la misma forma para que el id no dependa del nombre, que se puede
 * corregir.
 */
export const idDeInsigniaNueva = (ahora = Date.now()) => `p${Math.trunc(Number(ahora)) || 0}`;

export const ES_ID_PERSONALIZADO = /^p\d+$/;

/** Lo que se pide para dar de alta una: imagen, nombre y descripción. */
export const validarInsigniaNueva = ({ tipo, nombre, descripcion, tieneImagen }) => {
  if (!Object.values(TIPOS_INSIGNIA).includes(tipo)) return 'Tipo de insignia no válido.';
  if (!tieneImagen) return 'Elige la imagen.';
  if (!limpiar(nombre, MAXIMO_NOMBRE_INSIGNIA)) return 'Escribe el nombre.';
  if (!limpiar(descripcion, MAXIMO_DESCRIPCION_INSIGNIA)) return 'Escribe la descripción.';

  return '';
};

/**
 * Documento de Firestore → la forma del catálogo de su tipo, o null si está
 * roto. Lo roto no se pinta: una cinta sin imagen es un hueco en el perfil.
 */
export const insigniaDesdeDocumento = (documento = {}) => {
  const id = String(documento?.id ?? '')
    .trim()
    .toLowerCase();
  const tipo = documento?.tipo;
  const nombre = limpiar(documento?.nombre, MAXIMO_NOMBRE_INSIGNIA);
  const src = String(documento?.src ?? '').trim();

  if (!ES_ID_PERSONALIZADO.test(id) || !nombre || !ES_URL_DE_STORAGE.test(src)) return null;
  if (!Object.values(TIPOS_INSIGNIA).includes(tipo)) return null;

  const base = {
    id,
    tipo,
    nombre,
    descripcion: limpiar(documento?.descripcion, MAXIMO_DESCRIPCION_INSIGNIA),
    src,
    personalizada: true,
  };

  // La medalla lleva además su variante pequeña (la del perfil) y un número para
  // el orden de fábrica: detrás de todas las de la carpeta.
  return tipo === TIPOS_INSIGNIA.MEDALLA
    ? { ...base, srcPequena: src, numero: Number.MAX_SAFE_INTEGER }
    : base;
};

/** Todas las fichas → `{ cintas, medallas }`, cada lista por fecha de alta. */
export const separarInsignias = (documentos = []) => {
  const validas = (Array.isArray(documentos) ? documentos : [])
    .map(insigniaDesdeDocumento)
    .filter(Boolean)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  return {
    cintas: validas.filter((insignia) => insignia.tipo === TIPOS_INSIGNIA.CINTA),
    medallas: validas.filter((insignia) => insignia.tipo === TIPOS_INSIGNIA.MEDALLA),
  };
};

/** Lo que se guarda en Firestore al darla de alta. */
export const documentoDeInsigniaNueva = ({ id, tipo, nombre, descripcion, src, rutaStorage }) => ({
  id,
  tipo,
  nombre: limpiar(nombre, MAXIMO_NOMBRE_INSIGNIA),
  descripcion: limpiar(descripcion, MAXIMO_DESCRIPCION_INSIGNIA),
  src,
  rutaStorage,
});
