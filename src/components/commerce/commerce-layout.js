// ----------------------------------------------------------------------
// LAS MEDIDAS DE LAS PANTALLAS DE LA TIENDA.
//
// Una sola fuente para las cuatro —lista, pedidos, recibos y finalizar compra—
// porque la portada es la MISMA en todas y su alto se calcula a partir de su
// ancho: si una pantalla usa otro tope, alli sale mas estrecha y mas baja, y lo
// que se coloco mirando una no cuadra en la otra.
//
// Son dos medidas distintas a proposito:
//
//   - EL MARCO lo ocupa la portada, que es un rotulo y se lee mejor ancha.
//   - EL CONTENIDO va mas estrecho: cinco tarjetas repartidas en 1520 pixeles
//     quedan separadas por franjas de nada, y una fila estirada obliga al ojo a
//     cruzar media pantalla vacia de la fecha al importe.
// ----------------------------------------------------------------------

/** Tope del contenedor. La portada ocupa esto menos el relleno lateral (40). */
export const ANCHO_DEL_MARCO = 1600;

/** Tope de lo que va debajo de la portada: resumen, filtros, tablas, formularios. */
export const ANCHO_DEL_CONTENIDO = 1200;

/**
 * El relleno lateral del panel, para que el ancho util coincida fuera de el.
 *
 * `DashboardContent` usa `theme.spacing(5)` —40— de `lg` en adelante; el
 * checkout vive en un `Container` normal, que trae 24 por defecto, y con eso la
 * portada salia mas estrecha alli que en el resto.
 */
export const RELLENO_DEL_MARCO = { xs: 2, lg: 5 };
