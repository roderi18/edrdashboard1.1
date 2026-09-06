import { _mock } from 'src/_mock/_mock';

// ----------------------------------------------------------------------
// LISTA DE PRECIOS DE LA TIENDA ERRD.
//
// Transcripcion del documento oficial "TIENDA ERRD | Precios de insignias 2026"
// (docs/2026_08_06_ERRD-TIENDA Precios de insignias.pdf), tal cual: no se
// redondea, no se completa y no se inventa nada.
//
// Sus columnas son las que ya tiene el producto en el modelo:
//
//   - Renglon: `general` o `restringido`. Lo restringido no se vende a
//     cualquiera —lo marca `requiereAprobacion`, que el modelo deduce solo—.
//   - Precio de venta a destacamentos REGISTRADOS (`precioRegistrado`).
//   - Precio de venta a destacamentos NO REGISTRADOS (`precioNoRegistrado`).
//
// Dos casos que el documento deja en blanco y aqui se respetan:
//
//   - Articulos sin precio para NO registrados: van con 0, y la tabla los pinta
//     como "N/A" (ver RenderCellPrice). Poner ahi el precio de los registrados
//     seria inventarse una venta que el documento no autoriza.
//   - "Parche Consejo Nacional/Ejecutivo" no trae NINGUN precio: va con
//     `precioPendiente`, que es el campo que el modelo tiene justo para esto.
//
// La FOTO no esta en el documento. Se deja una de las imagenes de ejemplo para
// que la tarjeta no salga vacia; la de verdad se sube desde la ficha del
// producto.
// ----------------------------------------------------------------------

export const RENGLONES_TIENDA = {
  general: 'general',
  restringido: 'restringido',
};

const { general, restringido } = RENGLONES_TIENDA;

// [renglon, articulo, precio registrados, precio no registrados]
const LISTA = [
  [general, 'Emblema grande', 200, 230],
  [general, 'Emblema pequeño', 190, 220],
  [general, 'Insignia geográfica bandera RD', 175, 200],
  [general, 'Número bordado ud (0-9)', 70, 80],
  [general, 'Distintivo de grupo (N, P, S, E)', 150, 175],
  [general, 'Distintivo "Exploradores del Rey" (líderes)', 175, 200],
  [general, 'Parche de grupo (N, P, S, E)', 175, 200],
  [general, 'Insignia posición local (rango)', 250, 300],
  [restringido, 'Insignia organizacional (niveles 1-4)', 450, 550],
  [general, 'Cintas (naranja, azul, roja, café, verde, amarilla, platino, celeste)', 150, 200],
  [
    restringido,
    'Cintas (al logro N, al logro P, al logro SS, al logro E, senda del sable, taller teórico, taller práctico, servicio líder juvenil, servicio especial, servicio destacado, líder grupo, coordinador de dest., pastor, misiones)',
    200,
    0,
  ],
  [restringido, 'Cinta (al coraje, a la excelencia, nivel 1, nivel 2, nivel 3, nivel 4)', 250, 0],
  [restringido, 'Cinta (al valor, MOLH, mérito nacional, servicio sobresaliente)', 300, 0],
  [general, 'Número de metal para cintas (0-9)', 100, 150],
  [general, 'Barra para 1 cinta', 150, 175],
  [general, 'Barra para dos cintas', 175, 200],
  [general, 'Barra para tres cintas', 225, 250],
  [general, 'Parche adiestramiento ILJ', 250, 300],
  [restringido, 'Parches adiestramiento (OLI, ACD, CBD, F, M, S, CNM, DCM)', 300, 350],
  [general, 'Corbata bolo oficial ~ Emblema ER', 700, 800],
  [general, 'Corbata bolo de grupo (N, P, S, E)', 700, 800],
  [general, 'Correa nylon negra hebilla plateada', 300, 350],
  [general, 'Correa nylon caqui hebilla dorada', 300, 350],
  [restringido, 'Niveles Preparado, Seguridad y Adiestrado', 200, 300],
  [restringido, 'Nivel Avanzado', 400, 0],
  [restringido, 'Parche Consejo Nacional/Ejecutivo', 0, 0],
  [general, 'Gorra oficial Exploradores del Rey', 600, 750],
  [general, 'Pin oficial Exploradores del Rey', 250, 300],
  [general, 'Camiseta oficial RRD (4-14)', 275, 325],
  [general, 'Camiseta oficial RRD (16-M)', 325, 375],
  [general, 'Camiseta oficial RRD (L-XL)', 375, 425],
  [general, 'Camisa uniforme Utilitario', 2700, 3000],
  [general, 'Manual de aventuras campestres', 400, 500],
  [general, 'Carpeta de registro avance Líderes', 150, 250],
  [general, 'Carpeta de registro avance grupos (N, P, S, E)', 150, 200],
  [general, 'Cordón para corbata bolo', 200, 250],
  [general, 'Chaleco de premios (S)', 600, 650],
  [general, 'Chaleco de premios (M, L, XL)', 650, 700],
  [general, 'Pin Campamento 2024 Héroes', 200, 250],
  [general, 'Parche especial campamento nac 2024 Héroes', 100, 150],
  [general, 'Parche 25 km', 100, 150],
  [general, 'Parche 50 km', 100, 150],
  [general, 'Parche 100 km', 100, 150],
];

// El id sale del NOMBRE, no de un contador: asi cargar la lista dos veces
// reconoce lo que ya existe en vez de duplicarlo.
export const idDeArticuloDeTienda = (articulo = '') =>
  `insignia-${String(articulo)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)}`;

export const CATALOGO_TIENDA_INSIGNIAS = LISTA.map(
  ([renglon, articulo, precioRegistrado, precioNoRegistrado], index) => ({
    id: idDeArticuloDeTienda(articulo),
    name: articulo,
    renglon,
    precioRegistrado,
    precioNoRegistrado,
    // Sin precio en ninguna de las dos columnas: la Oficina Nacional todavia no
    // lo fijo, y el producto lo dice en vez de ensenar un cero.
    precioPendiente: !precioRegistrado && !precioNoRegistrado,
    // El precio "de tienda" es el de los registrados, que es el que paga la
    // mayoria; el otro lo resuelve la ficha segun quien compre.
    price: precioRegistrado,
    coverUrl: _mock.image.product(index % 24),
    orden: index + 1,
  })
);
