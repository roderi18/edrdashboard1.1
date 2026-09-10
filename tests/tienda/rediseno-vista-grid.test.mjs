import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

// LA TIENDA, EN LA VISTA DE REJILLA.
//
// Se rediseño SOLO la rejilla: la vista de panel —la tabla— se queda como
// estaba. Lo que estos casos vigilan es justo eso, y que el rediseño no haya
// inventado datos que la tienda no tiene.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const vista = leer('src/sections/product/view/product-list-view.jsx');
const tarjeta = leer('src/sections/product/product-grid-card.jsx');
const portada = leer('src/sections/product/store-header.jsx');
const columna = leer('src/sections/product/store-category-sidebar.jsx');

test('la vista de panel sigue siendo la misma tabla', () => {
  // Si alguna de estas desaparece, la vista de lista dejo de ser la de antes.
  assert.match(vista, /<DataGrid/);
  assert.match(vista, /checkboxSelection/);
  assert.match(vista, /<ProductTableToolbar/);
  assert.match(vista, /columnVisibilityModel=\{columnVisibilityModel\}/);
  assert.match(vista, /pageSizeOptions=\{\[5, 10, 20, \{ value: -1, label: 'Todos' \}\]\}/);
});

test('la rejilla ocupa todo el ancho y el panel no', () => {
  assert.match(vista, /maxWidth=\{displayMode === 'grid' \? false : 'lg'\}/);
});

test('la portada no lleva fotografia y sus textos los escribe el Administrador Global', () => {
  assert.match(portada, /isAdminGlobal\(user\)/);
  assert.match(portada, /guardarEncabezadoTienda/);
  // Degradado del tema, no una imagen.
  assert.match(portada, /backgroundImage: `linear-gradient/);
  assert.doesNotMatch(portada, /backgroundImage: `url|<Image/);
});

test('el encabezado se guarda por la puerta de cambios', () => {
  const servicio = leer('src/services/store-settings-service.js');
  const brazo = leer('src/services/store-settings-apply.js');
  const reglas = leer('firestore.rules');

  assert.match(servicio, /proponerCambio\(\{/);
  assert.match(servicio, /ambito: AMBITOS_CAMBIO\.tienda/);
  // La escritura vive en el brazo que aplica, no en el servicio.
  assert.doesNotMatch(servicio, /setDoc\(/);
  assert.match(brazo, /setDoc\(/);
  // Y la coleccion tiene su bloque propio, fuera del comodin.
  assert.match(reglas, /match \/configuracion_tienda\/\{documento\} \{/);
  assert.match(reglas, /coleccion != 'configuracion_tienda'/);
});

test('las categorias de la columna son las reales y escriben el mismo filtro', () => {
  assert.match(vista, /options=\{categoriaOptions\}/);
  assert.match(vista, /value=\{filters\.state\.categoria\}/);
  assert.match(vista, /onChange=\{\(categoria\) => filters\.setState\(\{ categoria \}\)\}/);
  // Salen de los productos, no de una lista escrita a mano.
  assert.match(vista, /tableData\.forEach\(\(product\) => \{/);
  assert.match(columna, /export function StoreCategorySidebar/);
});

test('la rejilla pagina y la busqueda la devuelve a la primera pagina', () => {
  assert.match(vista, /<TablePaginationCustom/);
  assert.match(vista, /const gridData = mobileData\.slice\(/);
  assert.match(vista, /setGridPage\(0\);\s*\n\s*\}, \[mobileSearch, filters\.state\]\);/);
});

test('las estrellas salen de las resenas guardadas, no de un numero inventado', () => {
  // La valoracion es la que escribio `product-review-service` en el producto
  // (`totalCalificaciones`/`totalResenas`), no un dato de la plantilla.
  assert.match(tarjeta, /product\.totalRatings/);
  assert.match(tarjeta, /product\.totalReviews/);
  assert.match(
    tarjeta,
    /<Rating size="small" value=\{totalRatings\} precision=\{0\.1\} readOnly \/>/
  );
  // Sin resenas no se pinta media estrella de adorno.
  assert.match(tarjeta, /totalReviews > 0 \?/);
  assert.match(tarjeta, /Sin valoraciones/);
});

test('la tarjeta no inventa descuentos', () => {
  // Los dos precios NO son una rebaja: son dos publicos distintos. (Se mira el
  // codigo, no los comentarios, porque uno de ellos dice justamente eso.)
  const codigo = tarjeta
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('//') && !linea.includes('descuento'))
    .join('\n');

  assert.doesNotMatch(codigo, /priceSale/);
  assert.match(tarjeta, /<Image/);
  assert.match(tarjeta, /fDopCurrency/);
  assert.match(tarjeta, /Restringido/);
});

test('la tarjeta ya no lleva etiqueta de inventario', () => {
  // Decia "En existencia" en casi todas y le robaba la linea al precio. Que no
  // queden existencias se sigue viendo: el carrito se apaga.
  // Se mira el codigo, no los comentarios: uno de ellos cuenta justamente por
  // que se quito la etiqueta y nombra los textos que tenia.
  const codigo = tarjeta
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('//'))
    .join('\n');

  assert.doesNotMatch(codigo, /etiquetaDeInventario|Pocas existencias|En existencia/);
  assert.doesNotMatch(codigo, /inventoryType/);
});

test('el borrador solo lo ve quien puede publicar', () => {
  // Un producto sin publicar no llega al resto de la tienda; ensenarle la
  // etiqueta a quien no puede hacer nada con ella solo confunde.
  assert.match(tarjeta, /\{canManageStore && !isPublished && \(/);
  assert.doesNotMatch(tarjeta, /!isMemberUser && !isPublished/);
});

test('el carrito es el que ya existia, no uno nuevo', () => {
  assert.match(vista, /onAddToCart=\{handleAddProductToCart\}/);
  assert.match(tarjeta, /onAddToCart\?\.\(product\)/);
  // El boton lo ve cualquiera que pueda comprar, no solo la sesion de miembro.
  assert.match(tarjeta, /\{!!onAddToCart && \(/);
  // Y sigue respetando las existencias.
  assert.match(tarjeta, /disabled=\{available <= 0\}/);
});
