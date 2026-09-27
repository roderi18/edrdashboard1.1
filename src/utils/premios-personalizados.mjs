// ----------------------------------------------------------------------
// PREMIOS AÑADIDOS DESDE LA APLICACIÓN (Sistema de Ascenso y Academia Ministerial).
//
// El Administrador Global añade un premio o una carpeta (nombre e imagen) en
// cualquier carpeta del árbol, y sale para todos detrás de los del catálogo
// (`src/_mock/_awards.js`). Se guardan en `premios_personalizados`; la imagen en
// `everest/premios/` (la carpeta de Storage del Administrador Global).
// Ids `pp<fecha>`: nunca chocan con los del catálogo, que son palabras.
// ----------------------------------------------------------------------

export const COLECCION_PREMIOS_PERSONALIZADOS = 'premios_personalizados';
export const MAXIMO_NOMBRE_PREMIO = 80;

export const idDePremioNuevo = (ahora = Date.now()) => `pp${Math.trunc(Number(ahora)) || 0}`;

// Qué se añade: un premio (tarjeta con check) o una carpeta (para agrupar).
export const TIPOS_NODO = { premio: 'premio', carpeta: 'carpeta' };

export const validarPremioNuevo = ({ nombre, idCarpeta, tieneImagen, tipo = TIPOS_NODO.premio }) => {
  const limpio = String(nombre ?? '').trim();
  if (!Object.values(TIPOS_NODO).includes(tipo)) return 'Elige si es un premio o una carpeta.';
  if (!idCarpeta) return 'Falta la carpeta.';
  if (limpio.length < 2) return `Escribe el nombre ${tipo === TIPOS_NODO.carpeta ? 'de la carpeta' : 'del premio'}.`;
  if (limpio.length > MAXIMO_NOMBRE_PREMIO) return `El nombre no puede pasar de ${MAXIMO_NOMBRE_PREMIO} caracteres.`;
  // La imagen es opcional: sin ella sale el icono de siempre (carpeta o PDF).
  void tieneImagen;
  return '';
};

/** Del documento guardado al nodo del árbol de premios (o null si está roto). */
export const premioDesdeDocumento = (documento = {}) => {
  const id = String(documento.id ?? '');
  const name = String(documento.nombre ?? '').trim();
  const parentId = String(documento.idCarpeta ?? '');
  const imagenUrl = String(documento.imagenUrl ?? '');
  if (!/^pp\d+$/.test(id) || !name || !parentId) return null;
  // Sin imagen (o con una URL rara) se pinta el icono de siempre.
  const imagen = imagenUrl.startsWith('https://') ? imagenUrl : '';
  if (documento.activo === false) return null;
  const esCarpeta = documento.tipo === TIPOS_NODO.carpeta;
  return {
    id,
    name,
    parentId,
    type: esCarpeta ? 'folder' : 'pdf',
    ...(imagen && { imagenUrl: imagen }),
    personalizado: true,
    createdAt: null,
    ...(esCarpeta && { tags: [], updatedAt: null, modifiedAt: null }),
  };
};

/** El catálogo más los añadidos (sin repetir id; los del catálogo mandan). */
export const unirPremios = (catalogo = [], personalizados = []) => {
  const ids = new Set(catalogo.map((n) => n.id));
  return [...catalogo, ...personalizados.filter((p) => p && !ids.has(p.id))];
};

// ----------------------------------------------------------------------
// MOVER PREMIOS Y CARPETAS (arrastrar, solo el Administrador Global).
//
// Se guarda un mapa id → carpeta nueva en `configuracion_premios/ubicaciones`
// y se aplica encima del árbol al leerlo, para todos. El PROGRESO de cada
// miembro sigue guardado donde estaba el premio al completarlo (su carpeta y
// división de origen): por eso el nodo movido conserva `parentIdOriginal`, y
// con él se lee y se escribe su estado y se busca su imagen.
// ----------------------------------------------------------------------

export const COLECCION_CONFIGURACION_PREMIOS = 'configuracion_premios';
export const DOCUMENTO_UBICACIONES = 'ubicaciones';

export const aplicarUbicaciones = (nodos = [], ubicaciones = {}) =>
  nodos.map((nodo) => {
    const destino = ubicaciones?.[nodo.id];
    if (!destino || destino === nodo.parentId) return nodo;
    return { ...nodo, parentId: destino, parentIdOriginal: nodo.parentIdOriginal ?? nodo.parentId };
  });

/** ¿`idPosibleHijo` está dentro (a cualquier profundidad) de `idCarpeta`? */
export const estaDentroDe = (nodos = [], idPosibleHijo, idCarpeta) => {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  let actual = porId.get(idPosibleHijo);
  const vistos = new Set();
  while (actual && !vistos.has(actual.id)) {
    if (actual.id === idCarpeta) return true;
    vistos.add(actual.id);
    actual = porId.get(actual.parentId);
  }
  return false;
};

/** Por qué no se puede mover (o '' si se puede). */
export const motivoParaNoMover = (nodos = [], idNodo, idDestino) => {
  const nodo = nodos.find((n) => n.id === idNodo);
  const destino = nodos.find((n) => n.id === idDestino);
  if (!nodo || !destino || destino.type !== 'folder') return 'Suéltalo encima de una carpeta.';
  if (nodo.parentId === idDestino) return 'Ya está en esa carpeta.';
  if (!nodo.parentId) return 'Los programas de la raíz no se mueven.';
  if (estaDentroDe(nodos, idDestino, idNodo)) return 'Una carpeta no puede ir dentro de sí misma.';
  return '';
};

/**
 * Dónde se guarda el progreso de un premio: su carpeta, división y sistema de
 * ORIGEN (en el árbol sin movimientos). Así, al moverlo, el completado y el
 * certificado de cada miembro siguen siendo los mismos.
 */
export const origenDelProgreso = (arbolBase = [], nodo = {}) => {
  const porId = new Map(arbolBase.map((n) => [n.id, n]));
  const carpeta = nodo.parentIdOriginal ?? nodo.parentId ?? null;
  let actual = porId.get(carpeta);
  let hijoDeRaiz = null;
  const vistos = new Set();
  while (actual && actual.parentId && !vistos.has(actual.id)) {
    vistos.add(actual.id);
    hijoDeRaiz = actual;
    actual = porId.get(actual.parentId);
  }
  return {
    carpeta,
    sistema: actual?.id ?? null,
    // La división es la carpeta que cuelga directamente del sistema.
    division: hijoDeRaiz && hijoDeRaiz.parentId === actual?.id ? hijoDeRaiz.id : null,
  };
};

// ----------------------------------------------------------------------
// CAMBIAR EL NOMBRE de un premio o una carpeta (Administrador Global).
//
// Mapa id → nombre nuevo en `configuracion_premios/nombres`, aplicado encima
// del árbol para todos. La imagen de las insignias se busca por NOMBRE, así que
// el nodo renombrado conserva `nameOriginal` para seguir encontrándola. Los dos
// programas de la raíz no se renombran: la pantalla los reconoce por su nombre.
// ----------------------------------------------------------------------

export const DOCUMENTO_NOMBRES = 'nombres';

export const aplicarNombres = (nodos = [], nombres = {}) =>
  nodos.map((nodo) => {
    const nuevo = String(nombres?.[nodo.id] ?? '').trim();
    if (!nuevo || nuevo === nodo.name || !nodo.parentId) return nodo;
    return { ...nodo, name: nuevo, nameOriginal: nodo.nameOriginal ?? nodo.name };
  });

export const motivoParaNoRenombrar = (nodo, nombre) => {
  const limpio = String(nombre ?? '').trim();
  if (!nodo) return 'No se encontró.';
  if (!nodo.parentId) return 'Los programas de la raíz no cambian de nombre.';
  if (limpio.length < 2) return 'Escribe el nombre.';
  if (limpio.length > MAXIMO_NOMBRE_PREMIO) return `Como mucho ${MAXIMO_NOMBRE_PREMIO} caracteres.`;
  if (limpio === nodo.name) return 'Es el mismo nombre.';
  return '';
};

// ----------------------------------------------------------------------
// CAMBIAR LA IMAGEN de un premio o carpeta (Administrador Global): mapa
// id → URL en `configuracion_premios/imagenes`. La imagen nueva manda sobre la
// del catálogo (`imagenDelPremio` y el icono de carpeta miran `imagenUrl` primero).
// ----------------------------------------------------------------------

export const DOCUMENTO_IMAGENES = 'imagenes';

export const aplicarImagenes = (nodos = [], imagenes = {}) =>
  nodos.map((nodo) => {
    const url = String(imagenes?.[nodo.id] ?? '');
    return url.startsWith('https://') ? { ...nodo, imagenUrl: url } : nodo;
  });

// ----------------------------------------------------------------------
// ELIMINAR un premio o carpeta (Administrador Global): deja de verse para todos.
// Mapa id → true en `configuracion_premios/eliminados`. Se oculta también todo
// lo que cuelga de una carpeta eliminada. El progreso de los miembros no se
// borra (queda guardado por si se recupera), solo deja de pintarse.
// ----------------------------------------------------------------------

export const DOCUMENTO_ELIMINADOS = 'eliminados';

export const quitarEliminados = (nodos = [], eliminados = {}) => {
  const fuera = new Set(Object.keys(eliminados || {}).filter((id) => eliminados[id]));
  if (!fuera.size) return nodos;
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const dentroDeEliminado = (nodo) => {
    let actual = nodo;
    const vistos = new Set();
    while (actual && !vistos.has(actual.id)) {
      if (fuera.has(actual.id)) return true;
      vistos.add(actual.id);
      actual = porId.get(actual.parentId);
    }
    return false;
  };
  return nodos.filter((n) => !dentroDeEliminado(n));
};
