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
//
// LO PROPIO DEL COMBO va en el campo opcional `combo` del producto (todo
// opcional; un producto sin él se pinta como un combo sencillo):
//
//   combo: {
//     etiqueta: 'Combo Plus',            // la píldora encima del nombre
//     numero: 1,                         // su puesto: el 1 sale primero
//     destacado: true,                   // la corona sobre la foto
//     finVenta: '2026-10-04T23:59:00-04:00', // el conteo regresivo; pasado, "Cerrado"
//     incluye: [{ tipo: 'camiseta', texto: 'Camiseta del campamento' }],
//     extras: [{ productoId: 'producto-…', titulo: 'Agregar parche de edición especial' }],
//   }
//
// Los EXTRAS son otros productos de la tienda (el parche de edición especial,
// los pines del evento): su precio y sus existencias se llevan allí. Se marcan
// con un interruptor y van UNO POR CADA COMBO elegido de ese tipo.
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

/** Lo que puede contener "incluye": cada tipo con su icono (ver `ICONO_DE_INCLUYE`). */
export const TIPOS_DE_INCLUYE = ['camiseta', 'parche', 'gorra', 'inscripcion', 'pin', 'otro'];

const texto = (valor, maximo = 80) =>
  String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);

const fechaValida = (valor) => {
  const fecha = new Date(valor ?? '');

  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
};

/**
 * El campo `combo` de un producto, limpio. Lo que no viene, o viene roto, se
 * queda fuera: un combo con datos a medias se pinta sin esa parte, nunca falla.
 */
export const sanearCombo = (combo) => {
  if (!combo || typeof combo !== 'object') return null;

  const numero = Number(combo.numero);
  const incluye = (Array.isArray(combo.incluye) ? combo.incluye : [])
    .map((item) => ({
      tipo: TIPOS_DE_INCLUYE.includes(item?.tipo) ? item.tipo : 'otro',
      texto: texto(item?.texto),
    }))
    .filter((item) => item.texto)
    .slice(0, 8);
  const extras = (Array.isArray(combo.extras) ? combo.extras : [])
    .map((extra) => ({ productoId: texto(extra?.productoId, 200), titulo: texto(extra?.titulo) }))
    .filter((extra) => extra.productoId)
    .slice(0, 4);

  return {
    etiqueta: texto(combo.etiqueta, 30),
    numero: Number.isInteger(numero) && numero > 0 ? numero : null,
    destacado: Boolean(combo.destacado),
    finVenta: fechaValida(combo.finVenta),
    incluye,
    extras,
  };
};

/**
 * Los combos publicados de la actividad, en su orden: primero por su `numero`
 * (el 1 arriba) y, si no lo tienen, del más caro al más barato. Antes salían
 * del más barato al más caro, y el combo principal —el "1"— quedaba el último.
 */
export function combosDeActividad(productos = [], tituloActividad = '') {
  const clave = claveDeActividad(tituloActividad);

  if (!clave) return [];

  const puesto = (producto) => sanearCombo(producto.combo)?.numero ?? Infinity;

  return (Array.isArray(productos) ? productos : [])
    .filter(
      (producto) =>
        producto && producto.publish !== 'draft' && claveDeActividad(producto.category) === clave
    )
    .sort((a, b) => puesto(a) - puesto(b) || Number(b.price || 0) - Number(a.price || 0));
}

/** Cuántos se pueden pedir de un combo: lo que hay en existencia (0 si está agotado). */
export const maximoDeCombo = (producto = {}) => Math.max(0, Number(producto.available) || 0);

/**
 * Lo que falta para que cierre la venta del combo, en días/horas/minutos/segundos.
 * `null` si el combo no tiene fecha de cierre; `cerrado: true` si ya pasó.
 */
export const tiempoRestante = (finVenta, ahora = Date.now()) => {
  const fin = finVenta ? new Date(finVenta).getTime() : NaN;

  if (Number.isNaN(fin)) return null;

  const restante = Math.max(0, Math.floor((fin - Number(ahora)) / 1000));

  return {
    cerrado: restante === 0,
    dias: Math.floor(restante / 86400),
    horas: Math.floor((restante % 86400) / 3600),
    minutos: Math.floor((restante % 3600) / 60),
    segundos: restante % 60,
  };
};

/** ¿Se puede pedir el combo ahora? Agotado o con la venta cerrada, no. */
export const comboAbierto = (producto = {}, ahora = Date.now()) =>
  maximoDeCombo(producto) > 0 &&
  !tiempoRestante(sanearCombo(producto.combo)?.finVenta, ahora)?.cerrado;

/** Los extras del combo con su producto de la tienda; los que no existen o no se venden, fuera. */
export const extrasDelCombo = (combo = {}, productos = []) => {
  const porId = new Map((Array.isArray(productos) ? productos : []).map((p) => [String(p.id), p]));

  return (sanearCombo(combo.combo)?.extras ?? [])
    .map((extra) => ({ ...extra, producto: porId.get(String(extra.productoId)) }))
    .filter(({ producto }) => producto && producto.publish !== 'draft');
};

/**
 * Cuántos de un extra van con un combo: uno por cada combo elegido, sin pasar
 * de lo que haya del extra en existencia.
 */
export const cantidadDeExtra = ({ cantidadCombo = 0, marcado = false, extra = {} } = {}) =>
  marcado ? Math.min(Math.max(0, Number(cantidadCombo) || 0), maximoDeCombo(extra)) : 0;

/** Lo que va al carrito por un combo (o un extra), con la misma forma que una compra de la tienda. */
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

/**
 * Todo lo que va al carrito y su total: los combos elegidos y, por cada uno,
 * sus extras marcados. Un mismo extra pedido desde dos combos se suma en una
 * sola línea.
 */
export const pedidoDeCombos = ({
  combos = [],
  productos = [],
  cantidades = {},
  extrasMarcados = {},
}) => {
  const lineas = new Map();
  let personas = 0;

  const sumar = (producto, cantidad) => {
    if (!cantidad) return;
    const previa = lineas.get(producto.id);
    // Nunca más de lo que hay, aunque lo pidan dos combos a la vez.
    const suma = Math.min((previa?.quantity ?? 0) + cantidad, maximoDeCombo(producto));
    lineas.set(producto.id, itemDeCarritoDeCombo(producto, suma));
  };

  combos.forEach((combo) => {
    const cantidadCombo = Number(cantidades[combo.id]) || 0;

    if (!cantidadCombo) return;

    personas += cantidadCombo;
    sumar(combo, cantidadCombo);

    extrasDelCombo(combo, productos).forEach(({ producto }) =>
      sumar(
        producto,
        cantidadDeExtra({
          cantidadCombo,
          marcado: Boolean(extrasMarcados[`${combo.id}:${producto.id}`]),
          extra: producto,
        })
      )
    );
  });

  const items = [...lineas.values()];

  return { items, personas, total: items.reduce((suma, item) => suma + item.subtotal, 0) };
};
