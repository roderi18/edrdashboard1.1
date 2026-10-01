// ----------------------------------------------------------------------
// AVISOS QUE SOLO VAN A LA CAMPANA, NUNCA AL SISTEMA NI AL CELULAR.
//
// Qué se rompía: cada aviso creado se mandaba también como push, y los de
// inventario llovían en el escritorio y en el teléfono ("Producto sin stock",
// "Producto con stock bajo"…), uno por producto, a quien administra la tienda.
// Son avisos de trabajo: se miran en la campana cuando se abre la tienda, no
// merecen interrumpir. Lo urgente de verdad (chat, aprobaciones, cumpleaños)
// sigue saliendo como push.
//
// Además, guardar un producto con pocas existencias repetía el aviso en cada
// guardado; ahora solo avisa al CRUZAR el umbral (`cruceDeExistencias`).
//
// Sin React ni Firebase, para poder probarlo con `node --test`.
// ----------------------------------------------------------------------

export const TIPOS_SOLO_CAMPANA = new Set([
  'producto_sin_stock',
  'producto_stock_bajo',
  'producto_disponible_nuevamente',
  'producto_publicado',
]);

/** ¿Este aviso se manda también como push (sistema y celular)? */
export const vaComoPush = (tipoNotificacion) =>
  !TIPOS_SOLO_CAMPANA.has(String(tipoNotificacion ?? '').trim());

export const UMBRAL_STOCK_BAJO = 10;

/**
 * Qué aviso de existencias toca al pasar de `antes` a `despues`, o null.
 * Solo al cruzar: quedarse en 0, o seguir por debajo de 10, no vuelve a avisar.
 * Un producto nuevo cuenta como si antes no hubiera tenido límite.
 */
export const cruceDeExistencias = ({ antes = null, despues = 0 } = {}) => {
  const previo = antes === null || antes === undefined ? Infinity : Number(antes) || 0;
  const actual = Number(despues) || 0;

  if (previo <= 0 && actual > 0) return 'producto_disponible_nuevamente';
  if (previo > 0 && actual <= 0) return 'producto_sin_stock';
  if (previo > UMBRAL_STOCK_BAJO && actual > 0 && actual <= UMBRAL_STOCK_BAJO) {
    return 'producto_stock_bajo';
  }

  return null;
};
