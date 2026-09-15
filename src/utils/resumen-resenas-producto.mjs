// ----------------------------------------------------------------------
// LAS ESTRELLAS DE LA LISTA DE LA TIENDA, CONTADAS DE LAS RESENAS REALES.
//
// La tarjeta leia `totalCalificaciones` y `totalResenas` del documento del
// producto, un resumen que solo se reescribe al publicar una resena. Cualquier
// otro guardado del producto lo dejaba en 0: "Emblema grande" tenia dos resenas
// (5 y 4) y en la ficha salian 4,5 estrellas, pero en la lista (0) y apagadas.
//
// La ficha ya las contaba de `resenas_productos`; ahora la lista hace lo mismo,
// con la misma cuenta, para todos los productos a la vez.
// ----------------------------------------------------------------------

// Igual que `buildProductReviewStats`: cada calificacion entre 1 y 5.
const acotarCalificacion = (valor) => Math.min(5, Math.max(1, Number(valor) || 0));

export const SIN_RESENAS = Object.freeze({ totalRatings: 0, totalReviews: 0 });

/** Media con un decimal y cuantas hay, como la ficha del producto. */
export const resumirCalificaciones = (calificaciones = []) => {
  const totalReviews = calificaciones.length;

  if (!totalReviews) return { ...SIN_RESENAS };

  const suma = calificaciones.reduce((acc, valor) => acc + acotarCalificacion(valor), 0);

  return { totalRatings: Number((suma / totalReviews).toFixed(1)), totalReviews };
};

/**
 * Agrupa los documentos de `resenas_productos` por producto. Una resena cuenta
 * una vez aunque llegue repetida: la ficha tambien las junta por id.
 */
export const agruparResumenPorProducto = (resenas = []) => {
  const porProducto = new Map();

  resenas.forEach((resena) => {
    const productoId = String(resena?.productoId ?? '').trim();

    if (!productoId) return;

    const idResena = String(resena?.resenaId || resena?.id || '');
    const delProducto = porProducto.get(productoId) || new Map();

    delProducto.set(idResena || `sin-id-${delProducto.size}`, resena?.calificacion);
    porProducto.set(productoId, delProducto);
  });

  return new Map(
    Array.from(porProducto, ([productoId, calificaciones]) => [
      productoId,
      resumirCalificaciones(Array.from(calificaciones.values())),
    ])
  );
};

/** Pone a cada producto las estrellas que dicen sus resenas, tenga o no. */
export const aplicarResumenResenas = (productos = [], resumenPorProducto = new Map()) =>
  productos.map((producto) => ({
    ...producto,
    ...(resumenPorProducto.get(String(producto?.id)) || SIN_RESENAS),
  }));
