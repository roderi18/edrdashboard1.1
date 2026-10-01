// ----------------------------------------------------------------------
// LOS COMBOS DE UNA ACTIVIDAD (la tarjeta "Próxima actividad" de /principal).
//
// Inscribirse a un campamento es comprarlo en la tienda: cada campamento tiene
// sus combos (normalmente tres) y se puede llevar más de uno, para inscribir a
// más personas. Los combos son PRODUCTOS NORMALES de la Tienda Virtual —precio,
// foto, existencias, orden y recibo de siempre— y se enlazan a la actividad por
// la CATEGORÍA: la categoría que se llama igual que la actividad
// ("Campamento Regional 2026") reúne sus combos. Sin categoría con ese nombre,
// el botón sigue llevando a donde llevaba.
// ----------------------------------------------------------------------

/** "Campamento Regional 2026" → "campamento-regional-2026" (como los ids de categoría). */
export const claveDeActividad = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Los combos publicados de la actividad, del más barato al más caro. */
export function combosDeActividad(productos = [], tituloActividad = '') {
  const clave = claveDeActividad(tituloActividad);

  if (!clave) return [];

  return (Array.isArray(productos) ? productos : [])
    .filter(
      (producto) =>
        producto && producto.publish !== 'draft' && claveDeActividad(producto.category) === clave
    )
    .sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
}

/** Cuántos se pueden pedir de un combo: lo que hay en existencia (0 si está agotado). */
export const maximoDeCombo = (producto = {}) => Math.max(0, Number(producto.available) || 0);

/** Lo que va al carrito por un combo, con la misma forma que una compra de la tienda. */
export const itemDeCarritoDeCombo = (producto = {}, cantidad = 1) => ({
  id: producto.id,
  name: producto.name,
  coverUrl: producto.coverUrl,
  available: producto.available,
  price: Number(producto.price) || 0,
  precioRegistrado: producto.precioRegistrado,
  precioNoRegistrado: producto.precioNoRegistrado,
  renglon: producto.renglon,
  tipoProducto: producto.tipoProducto,
  colors: [],
  size: '',
  quantity: cantidad,
  subtotal: (Number(producto.price) || 0) * cantidad,
});
