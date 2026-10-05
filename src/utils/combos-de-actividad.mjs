import { MEMBER_SHIRT_SIZES } from '../catalogs/member-catalogs.js';

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
// Mejor aún, la actividad puede llevar su CATEGORÍA ELEGIDA en el Designer
// (`categoriaCombos`): entonces manda esa y el título se puede cambiar sin
// perder los combos. Pasó con "Campamento Regional Inquebrantables 2027": al
// cambiar el título, "Inscribirme" volvió a mandar al calendario.
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
// los pines del evento): su precio y sus existencias se llevan allí. Cada uno
// lleva su contador (de 0 a lo que haya) y suma su precio por unidad; solo
// cuentan si se lleva el combo.
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
    // El producto de la tienda que se vende como camiseta ADICIONAL (paso 2).
    camisetaAdicional: texto(combo.camisetaAdicional, 200) || null,
    // Y el que se vende como parche ADICIONAL (sin tallas).
    parcheAdicional: texto(combo.parcheAdicional, 200) || null,
  };
};

/**
 * Los combos publicados de la actividad, en su orden: primero por su `numero`
 * (el 1 arriba) y, si no lo tienen, del más caro al más barato. Antes salían
 * del más barato al más caro, y el combo principal —el "1"— quedaba el último.
 */
export function combosDeActividad(productos = [], tituloActividad = '', categoriaCombos = '') {
  const clave = claveDeActividad(categoriaCombos || tituloActividad);

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
 * Cuántos de un extra van con un combo: los que se pidan con su contador (antes
 * era un interruptor, uno por combo), nunca más de lo que haya en existencia, y
 * ninguno si el combo no se lleva: son extras DEL combo.
 */
export const cantidadDeExtra = ({ cantidadCombo = 0, pedidos = 0, extra = {} } = {}) =>
  Number(cantidadCombo) > 0
    ? Math.min(Math.max(0, Math.floor(Number(pedidos) || 0)), maximoDeCombo(extra))
    : 0;

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
  // Lo de un campamento se recoge allí: no lleva dirección ni entrega. Antes el
  // pago pedía las dos y ofrecía envío "Expreso" a una inscripción.
  sinEntrega: true,
});

/**
 * ¿Se salta la dirección y la entrega? Solo si TODO el carrito es de combos
 * (inscripción, extras y adicionales): con un producto normal se envía como
 * siempre.
 */
export const carritoSinEntrega = (items = []) =>
  Array.isArray(items) && items.length > 0 && items.every((item) => item?.sinEntrega === true);

/**
 * Todo lo que va al carrito y su total: los combos elegidos y, por cada uno,
 * sus extras pedidos. Un mismo extra pedido desde dos combos se suma en una
 * sola línea.
 */
export const pedidoDeCombos = ({
  combos = [],
  productos = [],
  cantidades = {},
  cantidadesExtras = {},
  tallas = {},
  adicionales = null,
}) => {
  const lineas = new Map();
  let personas = 0;
  // UN SOLO REPARTO PARA TODAS LAS CAMISETAS (son iguales en todos los combos):
  // aquí se asigna por orden a cada combo, para que su línea diga qué tallas
  // lleva.
  const porCombo = repartirTallasEntreCombos({ combos, cantidades, reparto: tallas });

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

    // El reparto de tallas viaja en la línea del combo: `tallas` para sumarlo
    // si el carrito junta dos líneas, y `size` en texto, que es lo que la orden
    // guarda como `talla` ("M×2 · L×1").
    if (necesitaTallas(combo)) {
      const linea = lineas.get(combo.id);
      const reparto = porCombo[combo.id] ?? {};

      lineas.set(combo.id, {
        ...linea,
        tallas: reparto,
        size: textoDeTallas(reparto, tallasDelCombo(combo)),
      });
    }

    extrasDelCombo(combo, productos).forEach(({ producto }) =>
      sumar(
        producto,
        cantidadDeExtra({
          cantidadCombo,
          pedidos: cantidadesExtras[`${combo.id}:${producto.id}`],
          extra: producto,
        })
      )
    );
  });

  // LOS ADICIONALES (camisetas con su reparto de tallas, parches sin tallas): una
  // línea aparte cada uno, con su precio, si se pidió alguno y hay combos (son
  // para quien se inscribe).
  if (personas > 0 && adicionales?.camiseta?.producto) {
    const { producto } = adicionales.camiseta;
    const reparto = limpiarReparto(adicionales.camiseta.reparto);
    const unidades = Math.min(sumaDelReparto(reparto), maximoDeCombo(producto));

    if (unidades > 0) {
      lineas.set(producto.id, {
        ...itemDeCarritoDeCombo(producto, unidades),
        tallas: reparto,
        size: textoDeTallas(reparto, tallasDelCombo(producto)),
      });
    }
  }

  if (personas > 0 && adicionales?.parche?.producto) {
    const { producto } = adicionales.parche;
    const unidades = Math.min(
      Math.max(0, Math.floor(Number(adicionales.parche.cantidad) || 0)),
      maximoDeCombo(producto)
    );

    if (unidades > 0) sumar(producto, unidades);
  }

  const items = [...lineas.values()];

  return { items, personas, total: items.reduce((suma, item) => suma + item.subtotal, 0) };
};

// ----------------------------------------------------------------------
// LAS TALLAS DE CAMISETA (paso 2 de "Inscribirme").
//
// Un combo que incluye camiseta necesita saber de qué talla es cada una: tras
// elegir los combos, el paso 2 reparte las tallas de cada combo entre las que
// ofrece su producto (o las de la ficha del miembro si no tiene marcadas). No se agrega al carrito
// hasta que cada combo tiene tantas tallas como unidades.
// ----------------------------------------------------------------------

// Las mismas tallas que la ficha del miembro ("Size T-Shirt"): de niño (6 a 16)
// y de adulto (S a XXL). Antes solo S–XXL y a los pequeños no les cabía ninguna.
export const TALLAS_POR_DEFECTO = MEMBER_SHIRT_SIZES.map((talla) => talla.value);

/** ¿Lleva camiseta este combo? (lo dice "Incluye"). */
export const necesitaTallas = (combo = {}) =>
  (sanearCombo(combo.combo)?.incluye ?? []).some((item) => item.tipo === 'camiseta');

/** Las tallas que ofrece: las del producto en la tienda, o las de siempre. */
export const tallasDelCombo = (combo = {}) => {
  const propias = (Array.isArray(combo.sizes) ? combo.sizes : [])
    .map((talla) => String(talla ?? '').trim())
    .filter(Boolean);

  return propias.length ? propias : TALLAS_POR_DEFECTO;
};

/** `{ M: 2, L: 0 }` → `{ M: 2 }`: solo enteros positivos. */
export const limpiarReparto = (reparto = {}) =>
  Object.fromEntries(
    Object.entries(reparto ?? {})
      .map(([talla, cantidad]) => [talla, Math.max(0, Math.floor(Number(cantidad) || 0))])
      .filter(([, cantidad]) => cantidad > 0)
  );

export const sumaDelReparto = (reparto = {}) =>
  Object.values(limpiarReparto(reparto)).reduce((suma, cantidad) => suma + cantidad, 0);

/** "M×2 · L×1", en el orden de las tallas del combo. */
export const textoDeTallas = (reparto = {}, orden = TALLAS_POR_DEFECTO) => {
  const limpio = limpiarReparto(reparto);
  const tallas = [...orden, ...Object.keys(limpio).filter((talla) => !orden.includes(talla))];

  return tallas
    .filter((talla) => limpio[talla])
    .map((talla) => `${talla}×${limpio[talla]}`)
    .join(' · ');
};

/** Dos repartos en uno: el carrito junta dos líneas del mismo combo. */
export const combinarTallas = (a = {}, b = {}) => {
  const suma = { ...limpiarReparto(a) };

  Object.entries(limpiarReparto(b)).forEach(([talla, cantidad]) => {
    suma[talla] = (suma[talla] ?? 0) + cantidad;
  });

  return suma;
};

/**
 * El estado del paso 2: los combos elegidos que llevan camiseta, cuántas tallas
 * les faltan (o sobran) y si todo cuadra para agregar al carrito.
 */
export const estadoDeTallas = ({ combos = [], cantidades = {}, tallas = {} }) => {
  // Las camisetas son iguales en todos los combos: UN reparto común. Antes salía
  // un recuadro por combo y había que repartir las mismas camisetas dos veces.
  const filas = combos
    .filter((combo) => (Number(cantidades[combo.id]) || 0) > 0 && necesitaTallas(combo))
    .map((combo) => ({ combo, unidades: Number(cantidades[combo.id]) || 0 }));
  const unidades = filas.reduce((suma, fila) => suma + fila.unidades, 0);
  const asignadas = Math.min(sumaDelReparto(tallas), unidades);

  return {
    filas,
    hacenFalta: filas.length > 0,
    unidades,
    asignadas,
    faltan: unidades - sumaDelReparto(tallas),
    completo: sumaDelReparto(tallas) === unidades,
    // Las tallas que se ofrecen: las de los combos elegidos, sin repetir.
    tallas: [...new Set(filas.flatMap(({ combo }) => tallasDelCombo(combo)))],
  };
};

/**
 * El reparto común asignado a cada combo, por orden: el primer combo toma sus
 * unidades de las primeras tallas, y así. Es lo que viaja en la línea de cada
 * combo ("Combo Plus · M×2").
 */
export const repartirTallasEntreCombos = ({ combos = [], cantidades = {}, reparto = {} }) => {
  const quedan = Object.entries(limpiarReparto(reparto));
  const resultado = {};

  combos
    .filter((combo) => (Number(cantidades[combo.id]) || 0) > 0 && necesitaTallas(combo))
    .forEach((combo) => {
      let faltan = Number(cantidades[combo.id]) || 0;
      const propio = {};

      quedan.forEach((entrada) => {
        if (!faltan || !entrada[1]) return;
        const toma = Math.min(faltan, entrada[1]);
        propio[entrada[0]] = (propio[entrada[0]] ?? 0) + toma;
        entrada[1] -= toma;
        faltan -= toma;
      });

      resultado[combo.id] = propio;
    });

  return resultado;
};

/**
 * Cuánto se puede subir una talla: sin pasar de las unidades del combo. Antes
 * se podían asignar más tallas que combos ("Sobra 1"); ahora el "+" se apaga al
 * completarlas.
 */
export const maximoDeTalla = ({ unidades = 0, reparto = {}, talla }) => {
  const actual = limpiarReparto(reparto)[talla] ?? 0;

  return actual + Math.max(0, unidades - sumaDelReparto(reparto));
};

/**
 * Un adicional que ofrecen los combos elegidos (`camisetaAdicional` o
 * `parcheAdicional`): el producto de la tienda que alguno enlaza. Se paga aparte.
 */
export const adicionalDe = ({ combos = [], cantidades = {}, productos = [], campo }) => {
  const porId = new Map((Array.isArray(productos) ? productos : []).map((p) => [String(p.id), p]));
  const enlazado = combos
    .filter((combo) => (Number(cantidades[combo.id]) || 0) > 0)
    .map((combo) => sanearCombo(combo.combo)?.[campo])
    .find(Boolean);
  const producto = enlazado ? porId.get(String(enlazado)) : null;

  return producto && producto.publish !== 'draft' ? producto : null;
};

export const camisetaAdicionalDe = (datos) => adicionalDe({ ...datos, campo: 'camisetaAdicional' });

export const parcheAdicionalDe = (datos) => adicionalDe({ ...datos, campo: 'parcheAdicional' });
