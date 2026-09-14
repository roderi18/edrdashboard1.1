import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

const TARJETA = leer('src/sections/product/product-grid-card.jsx');
const FORMULARIO = leer('src/sections/product/product-create-edit-form.jsx');
const SERVICIO = leer('src/services/notification-service.js');
const FILA = leer('src/layouts/components/notifications-drawer/notification-item.jsx');
const FOTOS = leer('src/layouts/components/notifications-drawer/use-fotos-de-aviso.js');

// ----------------------------------------------------------------------
// LA CINTA ROJA "NUEVO".
//
// Empezo como prueba local pegada a un producto por su nombre. Ahora es del
// producto: se enciende desde la ficha —crear o editar— y se guarda en
// `etiquetaNuevo`, que ya existia pero no pintaba nada en la tienda.
// ----------------------------------------------------------------------

test('la cinta sale del producto, no de un nombre escrito en el codigo', () => {
  assert.match(TARJETA, /if \(!product\?\.newLabel\?\.enabled\) return '';/);
  assert.doesNotMatch(TARJETA, /correa nylon negra/i);
  // "Nuevo" no depende de estar en desarrollo. Lo unico atado a `NODE_ENV` es
  // una cinta de PRUEBA marcada como tal, y nunca la de "Nuevo".
  const cintaNuevo = TARJETA.slice(
    TARJETA.indexOf('const textoDeLaCinta'),
    TARJETA.indexOf('export function ProductGridCard')
  );
  assert.doesNotMatch(cintaNuevo.split('PRUEBA LOCAL')[0], /NODE_ENV/);
});

// Vacio decia "Nuevo"; ahora "Recién agregado", que con el tope de 12 se cortaba
// en "RECIÉN AGREG". El tope es 16, el mismo en la tarjeta y en el formulario.
test('sin texto dice "Recién agregado", y cabe entero en la cinta', () => {
  assert.match(TARJETA, /const TEXTO_DE_CINTA_POR_DEFECTO = 'Recién agregado';/);
  assert.match(TARJETA, /const TOPE_DE_TEXTO_DE_CINTA = 16;/);
  assert.match(FORMULARIO, /maxLength: 16/);
  assert.ok('Recién agregado'.length <= 16);
  // Roja, salvo "Agotado", que va en gris.
  assert.match(TARJETA, /fondo: esAgotado \? 'grey\.800' : 'error\.main'/);
});

test('la opcion esta en el formulario, que es el mismo para crear y editar', () => {
  assert.match(
    FORMULARIO,
    /name="newLabel\.enabled"\s+label="Mostrar cinta roja de nuevo en la tienda"/
  );
  assert.match(FORMULARIO, /name="newLabel\.content"/);
  assert.match(FORMULARIO, /newLabel: \{ enabled: false, content: '' \}/);
});

// ----------------------------------------------------------------------
// LOS AVISOS DE PRODUCTO: NOMBRE, FOTO DEL PRODUCTO Y CARA DE QUIEN ACTUA.
//
// Salian "El producto tiene stock bajo: ." —la plantilla pedia
// `{{nombreProducto}}` y el aviso guardaba `productName`—, con el circulo vacio y
// con el bloque de demostracion de la plantilla debajo: un adjunto
// "design-suriname-2015.mp3" o tres etiquetas "Design".
// ----------------------------------------------------------------------

test('los tres avisos de producto tienen su propio tipo visual', () => {
  assert.match(SERVICIO, /producto_publicado: 'producto',/);
  assert.match(SERVICIO, /producto_sin_stock: 'producto',/);
  assert.match(SERVICIO, /producto_stock_bajo: 'producto',/);
});

test('el nombre se guarda con la clave que usa la plantilla', () => {
  assert.match(SERVICIO, /nombreProducto: productName,/);
  assert.match(SERVICIO, /imagenProducto: obtenerFotoProducto\(producto\) \|\| null,/);
  assert.equal([...SERVICIO.matchAll(/metadatos: metadatosDeProducto\(producto,/g)].length, 3);
});

test('los avisos ya guardados se leen con nombre: la frase se arma al pintarla', () => {
  assert.match(SERVICIO, /metadatos\.nombreProducto \|\| metadatos\.productName/);
  assert.match(SERVICIO, /const tituloDeProducto = construirTituloDeProducto\(notificacion\);/);
});

test('una foto vacia de la sesion no tapa la cara de quien actua', () => {
  assert.match(SERVICIO, /usuario\?\.photoURL \|\| usuario\?\.avatarUrl \|\| null/);
  assert.equal([...SERVICIO.matchAll(/actorFotoURL: fotoDeQuienActua\(usuario\),/g)].length, 3);
});

test('la campana pinta el producto y busca las fotos que faltan', () => {
  assert.match(FILA, /\{esDeProducto && renderProductoAction\(\)\}/);
  assert.match(
    FILA,
    /const fotoDelCirculo = esDeProducto \? fotoPersona : notification\.avatarUrl;/
  );
  assert.match(FOTOS, /doc\(FIRESTORE, 'productos', String\(idProducto\)\)/);
  assert.match(
    FOTOS,
    /obtenerFotoPrincipal\(\{ tipoEntidad: 'miembro', idEntidad: idMiembros \}\)/
  );
});
