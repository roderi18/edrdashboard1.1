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
const fotoPortada = leer('src/sections/product/store-header-photo.jsx');
const columna = leer('src/sections/product/store-category-sidebar.jsx');

test('la vista de panel sigue siendo la misma tabla', () => {
  // Si alguna de estas desaparece, la vista de lista dejo de ser la de antes.
  assert.match(vista, /<DataGrid/);
  assert.match(vista, /checkboxSelection/);
  assert.match(vista, /<ProductTableToolbar/);
  assert.match(vista, /columnVisibilityModel=\{columnVisibilityModel\}/);
  assert.match(vista, /pageSizeOptions=\{\[5, 10, 20, \{ value: -1, label: 'Todos' \}\]\}/);
});

test('la tienda abre en rejilla en cualquier pantalla', () => {
  // Es un escaparate: sin las fotos delante no se distingue una insignia de
  // otra. Antes solo el movil entraba en rejilla y el escritorio abria la
  // tabla, que es la vista de trabajo del gestor.
  assert.match(vista, /const displayMode = selectedDisplayMode \|\| 'grid';/);
  assert.doesNotMatch(vista, /isMobile \? 'grid' : 'panel'/);
  // Y con llave propia: lo que se eligio en otra lista no decide como abre la
  // tienda.
  assert.doesNotMatch(vista, /global-display-mode/);
  assert.match(vista, /storageKey="store-display-mode"/);
  assert.match(leer('src/sections/product/product-table-toolbar.jsx'), /store-display-mode/);
});

test('la rejilla ocupa todo el ancho y el panel no', () => {
  assert.match(vista, /maxWidth=\{displayMode === 'grid' \? false : 'lg'\}/);
});

test('la portada sin foto sigue siendo el degradado del tema', () => {
  assert.match(portada, /isAdminGlobal\(user\)/);
  assert.match(portada, /guardarEncabezadoTienda/);
  // Sin foto no hay imagen que cargar: el fondo lo pone el tema.
  assert.match(portada, /encabezado\.fotoUrl\s*$/m);
  assert.match(portada, /linear-gradient\(135deg, \$\{theme\.vars\.palette\.primary\.darker\}/);
});

test('la portada tiene dos disposiciones y la clasica sigue siendo la de siempre', () => {
  const servicio = leer('src/services/store-settings-service.js');

  // La franja es la del rotulo impreso: titulo con el pais debajo, una raya
  // vertical y el lema a la derecha. La clasica —lema debajo del titulo— es la
  // que se sirve mientras nadie elija otra cosa, asi que nada cambia solo.
  assert.match(servicio, /disposicion: DISPOSICION_CLASICA,/);
  assert.match(servicio, /export const DISPOSICIONES_ENCABEZADO = \[/);
  // Una disposicion inventada no se guarda: se cae a la clasica.
  assert.match(servicio, /DISPOSICIONES_ENCABEZADO\.includes\(limpiar\(valor\)\)/);

  assert.match(portada, /const esFranja = encabezado\.disposicion === DISPOSICION_FRANJA;/);
  assert.match(portada, /\{esFranja \? \(/);
  assert.match(portada, /orientation="vertical"/);
  assert.match(portada, /\{encabezado\.pieTitulo\}/);
  // Y se elige en el mismo lapiz, con el resto del encabezado.
  assert.match(portada, /label="Disposición"/);
  // El texto bajo el titulo solo se pide donde se lee.
  assert.match(portada, /borrador\.disposicion === DISPOSICION_FRANJA && \(/);
});

test('la foto de la portada se encuadra en su propio recuadro', () => {
  // Mover y acercar donde luego se va a ver, no en un dialogo aparte que elegia
  // sobre un cuadrado para despues recortar a lo ancho.
  assert.match(fotoPortada, /<Cropper/);
  assert.match(fotoPortada, /aspect=\{PROPORCION\}/);
  assert.match(fotoPortada, /onZoomChange=\{setAcercamiento\}/);
  assert.doesNotMatch(fotoPortada, /<Dialog/);
});

test('cancelar y guardar el encuadre solo estan mientras hay foto que decidir', () => {
  // Resuelto el encuadre —de una forma o de otra— los dos botones se van, y no
  // vuelven hasta que se elige otra foto.
  assert.match(fotoPortada, /const enEncuadre = !!origen;/);
  assert.match(fotoPortada, /\{enEncuadre \? \(/);
  assert.match(fotoPortada, /onClick=\{limpiarEncuadre\}/);
  assert.match(fotoPortada, /onClick=\{handleGuardarEncuadre\}/);
  assert.match(fotoPortada, /setOrigen\(null\);/);
});

test('la foto sube al guardar el encabezado, no al encuadrarla', () => {
  // Cerrar el dialogo sin guardar no puede dejar subidas huerfanas en Storage.
  assert.match(portada, /uploadOptimizedImage\(\{/);
  assert.match(portada, /storagePath: `tienda\/encabezado-\$\{Date\.now\(\)\}\.webp`/);
  assert.match(fotoPortada, /new File\(\[blob\]/);
  assert.doesNotMatch(fotoPortada, /uploadOptimizedImage/);
  // Y la carpeta tiene su regla propia: la ve quien entra, la cambia el
  // Administrador Global.
  const reglas = leer('storage.rules');
  assert.match(reglas, /match \/tienda\/\{archivo\} \{/);
  // Y desde que la tienda la lleva su propio administrador, tambien el.
  assert.match(
    reglas,
    /allow create, update: if \(esAdministradorGlobal\(\) \|\| esAdministradorDeTienda\(\)\)/
  );
});

test('el encabezado se guarda por la puerta de cambios', () => {
  const servicio = leer('src/services/store-settings-service.js');
  const brazo = leer('src/services/store-settings-apply.js');
  const reglas = leer('firestore.rules');

  assert.match(servicio, /proponerCambio\(\{/);
  assert.match(servicio, /ambito: AMBITOS_CAMBIO\.tienda/);
  // La foto es un cambio como los textos: quien la puso tiene que constar.
  assert.match(servicio, /etiqueta: 'Fotografía'/);
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
  assert.match(tarjeta, /value=\{sinResenas \? 0 : totalRatings\}/);
});

test('sin resenas las estrellas van apagadas y el total es cero', () => {
  // Las cinco estrellas siempre estan —si no, las tarjetas miden distinto y la
  // rejilla baila—, pero en gris y con (0): no se finge una nota que nadie dio.
  assert.match(tarjeta, /const sinResenas = totalReviews <= 0;/);
  assert.match(tarjeta, /sinResenas && \{\s*\n?\s*color: 'text\.disabled'/);
  assert.match(tarjeta, /\(\{sinResenas \? 0 : fShortenNumber\(totalReviews\)\}\)/);
});

test('las estrellas van debajo del precio y la categoria al pie de la foto', () => {
  // Primero el numero que decide la compra, despues la opinion ajena. Y la
  // categoria pegada a lo que describe, no compitiendo con el nombre.
  const cuerpo = tarjeta.slice(tarjeta.indexOf('{renderPrecios()}'));
  assert.ok(cuerpo.indexOf('{renderValoracion()}') > 0, 'la valoracion va tras el precio');
  const foto = tarjeta.slice(tarjeta.indexOf('{renderEstadosSobreLaFoto()}'));
  assert.match(foto.slice(0, foto.indexOf('</Box>')), /right: 8,\s*\n\s*bottom: 8,/);
});

test('el precio de no registrados va al lado y tachado', () => {
  // Mismo cuerpo de letra que el precio, con una raya en medio: se lee "este no
  // es el tuyo" sin gastar una linea en explicarlo.
  assert.match(tarjeta, /textDecoration: 'line-through'/);
  assert.match(tarjeta, /<Stack direction="row" spacing=\{1\} alignItems="baseline"/);
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
