// ----------------------------------------------------------------------
// CATEGORÍAS DE PRODUCTO AÑADIDAS DESDE /product/new.
//
// La tienda arrancó con un catálogo fijo de ocho categorías ("ERRD"), escrito a
// mano en `product-create-edit-form.jsx`. El día que hiciera falta una que no
// estaba ahí, había que tocar código para añadirla. Ahora quien administra la
// tienda la agrega con el botón "+ Nuevo" del propio formulario: se guarda en
// Firestore y aparece en el desplegable de Categoría y en la columna de
// Categorías de `/product`, con cero productos hasta que alguno la use.
//
// El id es el nombre convertido a minúsculas y con guiones (`slugificar`), igual
// que las categorías de fábrica ('barras-numeros', 'insignias-emblemas'…): así
// un producto guarda el mismo tipo de valor tenga la categoría el origen que
// tenga. El NOMBRE tal como se escribió se guarda aparte para mostrarlo tal
// cual, sin depender de cómo quede el id.
//
// Sin React ni Firebase, para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

export const COLECCION_CATEGORIAS_PRODUCTO = 'categorias_producto_personalizadas';

export const MAXIMO_NOMBRE_CATEGORIA_PRODUCTO = 60;

const limpiar = (valor, maximo) =>
  String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);

/** "Recuerdos y Regalos" → "recuerdos-y-regalos". Igual que los ids de fábrica. */
export const slugificarCategoriaProducto = (nombre) =>
  String(nombre ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Lo que se pide para dar de alta una categoría: solo el nombre. */
export const validarCategoriaProductoNueva = (nombre) => {
  const limpio = limpiar(nombre, MAXIMO_NOMBRE_CATEGORIA_PRODUCTO);

  if (!limpio) return 'Escribe el nombre.';
  if (!slugificarCategoriaProducto(limpio)) {
    return 'Ese nombre no sirve para identificar la categoría.';
  }

  return '';
};

/** Documento de Firestore → `{ value, label }` del catálogo, o null si está roto. */
export const categoriaProductoDesdeDocumento = (documento = {}) => {
  const id = String(documento?.id ?? '').trim();
  const nombre = limpiar(documento?.nombre, MAXIMO_NOMBRE_CATEGORIA_PRODUCTO);

  if (!id || !nombre) return null;

  return { value: id, label: nombre, personalizada: true };
};

/** Todas las fichas válidas, sin repetir id, ordenadas por nombre. */
export const categoriasProductoDesdeDocumentos = (documentos = []) => {
  const vistas = new Map();

  (Array.isArray(documentos) ? documentos : [])
    .map(categoriaProductoDesdeDocumento)
    .filter(Boolean)
    .forEach((categoria) => vistas.set(categoria.value, categoria));

  return [...vistas.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'));
};

/** Lo que se guarda en Firestore al darla de alta. */
export const documentoDeCategoriaProductoNueva = ({ id, nombre }) => ({
  id,
  nombre: limpiar(nombre, MAXIMO_NOMBRE_CATEGORIA_PRODUCTO),
});

// ----------------------------------------------------------------------
// LA ETIQUETA EXACTA, para quien solo tiene el id (`etiquetaDeCategoria`).
//
// Las categorías de fábrica traducen su id a un texto fijo
// (`translateProductCategory`, en `product-table-row.jsx`); las personalizadas
// no tienen esa traducción, así que se registra aquí el nombre tal como se
// escribió. Sin esto, "Recuerdos y Regalos" se leería "Recuerdos-Y-Regalos" en
// la lista de productos, deducido a la fuerza del id.
// ----------------------------------------------------------------------

let etiquetasPersonalizadas = new Map();

export const registrarCategoriasProductoPersonalizadas = (categorias = []) => {
  etiquetasPersonalizadas = new Map(
    (Array.isArray(categorias) ? categorias : []).map((categoria) => [
      categoria.value,
      categoria.label,
    ])
  );
};

export const etiquetaDeCategoriaProductoPersonalizada = (valor) =>
  etiquetasPersonalizadas.get(String(valor ?? '').trim()) ?? null;
