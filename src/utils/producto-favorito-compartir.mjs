// ----------------------------------------------------------------------
// FAVORITO Y COMPARTIR EN LA FICHA DEL PRODUCTO.
//
// Los dos enlaces estaban dibujados pero no hacian nada: "Favorito" no marcaba y
// "Compartir" no compartia. Ahora el favorito se guarda por persona y compartir
// manda el producto al chat de alguien, eligiendolo de un desplegable.
// ----------------------------------------------------------------------

/**
 * Un documento por persona, con el uid de la sesion como id: asi la regla de
 * Firestore solo tiene que comparar el id con `request.auth.uid`.
 */
export const COLECCION_FAVORITOS_PRODUCTOS = 'favoritos_productos';

/** Los ids de los productos marcados, desde el mapa `productos` del documento. */
export const leerProductosFavoritos = (documento = {}) =>
  new Set(
    Object.entries(documento?.productos || {})
      .filter(([, marcado]) => marcado === true)
      .map(([productoId]) => String(productoId))
  );

/** Lo que queda al pulsar el corazon: se quita si estaba y se pone si no. */
export const alternarFavorito = (favoritos = new Set(), productoId = '') => {
  const siguiente = new Set(favoritos);
  const id = String(productoId || '');

  if (!id) return siguiente;

  if (siguiente.has(id)) {
    siguiente.delete(id);
  } else {
    siguiente.add(id);
  }

  return siguiente;
};

/**
 * El mensaje que llega al chat. Lleva el enlace a la ficha para que quien lo
 * recibe entre directo al producto, no a buscarlo en la tienda.
 */
export const mensajeCompartirProducto = ({ nombre = '', url = '' } = {}) =>
  [`Te comparto este producto de la Tienda Virtual: ${String(nombre).trim() || 'Producto'}`, url]
    .filter(Boolean)
    .join('\n');

/**
 * A quien se puede enviar: todos los contactos del chat menos uno mismo. Se
 * compara por `idMiembros` y por `id`, que es como el chat identifica a cada uno.
 */
export const destinatariosParaCompartir = (contactos = [], yo = {}) => {
  const propios = new Set(
    [yo?.idMiembros, yo?.id]
      .filter((valor) => valor !== null && valor !== undefined && valor !== '')
      .map(String)
  );

  return contactos.filter(
    (contacto) =>
      contacto &&
      ![contacto.idMiembros, contacto.id]
        .filter((valor) => valor !== null && valor !== undefined && valor !== '')
        .some((valor) => propios.has(String(valor)))
  );
};

/**
 * La tarjeta que viaja con el mensaje: el chat la pinta con imagen, nombre y
 * precio, y al pulsarla lleva a la ficha. La ruta va siempre a la ficha del
 * panel —la que valida el modelo del mensaje—, se haya compartido desde donde se
 * haya compartido.
 */
export const tarjetaProductoCompartido = (producto = {}) => {
  const id = String(producto?.id ?? '').trim();
  const precio = Number(producto?.price);
  const imagen = String(producto?.coverUrl || producto?.images?.[0] || '').trim();

  if (!id) return null;

  return {
    id,
    name: String(producto?.name || '').trim() || 'Producto',
    url: `/dashboard/product/${encodeURIComponent(id)}`,
    ...(Number.isFinite(precio) && precio >= 0 && { price: precio }),
    ...(imagen && { imageUrl: imagen }),
  };
};
