// ----------------------------------------------------------------------
// CINTAS, MEDALLAS Y PINES AÑADIDOS DESDE EXPLORA DESIGNER.
//
// Las de fábrica salen de `public/insignias/`: para sumar una
// había que dejar la imagen en la carpeta y, en las cintas, además tocar código,
// y en producción nadie puede escribir en esa carpeta. Estas otras las añade el
// Administrador Global desde el Designer con su imagen, nombre y descripción: la
// imagen va a Storage (`everest/insignias-{tipo}/`) y la ficha a Firestore
// (`insignias_personalizadas/{id}`). Se suman al catálogo de fábrica, detrás de
// todas, y se ordenan y se asignan igual que las demás.
//
// EDITAR Y ELIMINAR TODAS, TAMBIÉN LAS DE FÁBRICA. Una añadida se edita en su
// propia ficha y se elimina marcándola `activo: false` (no se borra: las ya
// asignadas a miembros siguen apuntando a su id; simplemente deja de pintarse).
// Una de fábrica vive en `public/`, que en producción no se puede tocar: se
// guarda un AJUSTE (`f-{tipo}-{id}`, con `fabrica: true`) con su nombre,
// descripción o imagen nuevos, u `oculta: true` para quitarla del catálogo.
// Agregan y editan el Administrador Global y la Oficina Nacional; elimina solo
// el Administrador Global.
//
// Sin React ni Firebase para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

export const COLECCION_INSIGNIAS_PERSONALIZADAS = 'insignias_personalizadas';

export const TIPOS_INSIGNIA = Object.freeze({ CINTA: 'cinta', MEDALLA: 'medalla', PIN: 'pin' });

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
  // Eliminada: deja de pintarse en todas partes.
  if (documento?.activo === false) return null;

  const base = {
    id,
    tipo,
    nombre,
    descripcion: limpiar(documento?.descripcion, MAXIMO_DESCRIPCION_INSIGNIA),
    src,
    personalizada: true,
  };

  // La medalla y el pin llevan además su variante pequeña (la del perfil) y un
  // número para el orden de fábrica: detrás de todos los de su carpeta.
  return tipo === TIPOS_INSIGNIA.CINTA
    ? base
    : { ...base, srcPequena: src, numero: Number.MAX_SAFE_INTEGER };
};

// ----------------------------------------------------------------------
// LOS AJUSTES DE LAS DE FÁBRICA.
// ----------------------------------------------------------------------

/** El id del ajuste de una de fábrica: estable, sin "/" (no cabe en un id de Firestore). */
export const idDeAjusteDeFabrica = (tipo, idFabrica) =>
  `f-${tipo}-${String(idFabrica ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')}`;

/** Documento → `{ tipo, idFabrica, nombre?, descripcion?, src?, oculta }`, o null si no es un ajuste. */
export const ajusteDesdeDocumento = (documento = {}) => {
  if (documento?.fabrica !== true) return null;

  const tipo = documento?.tipo;
  const idFabrica = String(documento?.idFabrica ?? '').trim();

  if (!Object.values(TIPOS_INSIGNIA).includes(tipo) || !idFabrica) return null;

  const nombre = limpiar(documento?.nombre, MAXIMO_NOMBRE_INSIGNIA);
  const descripcion = limpiar(documento?.descripcion, MAXIMO_DESCRIPCION_INSIGNIA);
  const src = String(documento?.src ?? '').trim();

  return {
    tipo,
    idFabrica,
    ...(nombre ? { nombre } : {}),
    ...(descripcion ? { descripcion } : {}),
    // Solo una imagen de nuestro Storage reemplaza a la de la carpeta.
    ...(ES_URL_DE_STORAGE.test(src) ? { src } : {}),
    oculta: documento?.oculta === true,
  };
};

/**
 * Las de fábrica de un tipo con sus ajustes: nombre, descripción e imagen
 * cambiados, y sin las eliminadas. `ajustes` es `{ [idFabrica]: ajuste }`.
 * Medallas y pines llevan además `srcPequena`, que sigue a la imagen nueva.
 */
export const aplicarAjustes = (catalogo = [], ajustes = {}) => {
  if (!ajustes || !Object.keys(ajustes).length) return catalogo;

  return catalogo.flatMap((insignia) => {
    const ajuste = ajustes[String(insignia?.id ?? '')];

    if (!ajuste) return [insignia];
    if (ajuste.oculta) return [];

    return [
      {
        ...insignia,
        ...(ajuste.nombre ? { nombre: ajuste.nombre } : {}),
        ...(ajuste.descripcion ? { descripcion: ajuste.descripcion } : {}),
        ...(ajuste.src
          ? { src: ajuste.src, ...('srcPequena' in insignia ? { srcPequena: ajuste.src } : {}) }
          : {}),
        ajustada: true,
      },
    ];
  });
};

/** Todas las fichas → `{ cintas, medallas, pines, ajustes }`, cada lista por fecha de alta. */
export const separarInsignias = (documentos = []) => {
  const ajustes = { cinta: {}, medalla: {}, pin: {} };

  (Array.isArray(documentos) ? documentos : []).forEach((documento) => {
    const ajuste = ajusteDesdeDocumento(documento);

    if (ajuste) ajustes[ajuste.tipo][ajuste.idFabrica] = ajuste;
  });

  const validas = (Array.isArray(documentos) ? documentos : [])
    .map(insigniaDesdeDocumento)
    .filter(Boolean)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  return {
    cintas: validas.filter((insignia) => insignia.tipo === TIPOS_INSIGNIA.CINTA),
    medallas: validas.filter((insignia) => insignia.tipo === TIPOS_INSIGNIA.MEDALLA),
    pines: validas.filter((insignia) => insignia.tipo === TIPOS_INSIGNIA.PIN),
    ajustes,
  };
};

/** Lo que se pide al editar: nombre y descripción (la imagen es opcional, se queda la que tiene). */
export const validarInsigniaEditada = ({ nombre, descripcion }) => {
  if (!limpiar(nombre, MAXIMO_NOMBRE_INSIGNIA)) return 'Escribe el nombre.';
  if (!limpiar(descripcion, MAXIMO_DESCRIPCION_INSIGNIA)) return 'Escribe la descripción.';

  return '';
};

export const limpiarNombreInsignia = (nombre) => limpiar(nombre, MAXIMO_NOMBRE_INSIGNIA);
export const limpiarDescripcionInsignia = (texto) => limpiar(texto, MAXIMO_DESCRIPCION_INSIGNIA);

/** Lo que se guarda en Firestore al darla de alta. */
export const documentoDeInsigniaNueva = ({ id, tipo, nombre, descripcion, src, rutaStorage }) => ({
  id,
  tipo,
  nombre: limpiar(nombre, MAXIMO_NOMBRE_INSIGNIA),
  descripcion: limpiar(descripcion, MAXIMO_DESCRIPCION_INSIGNIA),
  src,
  rutaStorage,
});
