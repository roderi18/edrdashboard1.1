// ----------------------------------------------------------------------
// LOS AVISOS DE INVENTARIO SOLO VAN A LA CAMPANA, Y SOLO AL CRUZAR EL UMBRAL.
//
// Qué se rompía: "Producto sin stock" y "Producto con stock bajo" salían como
// notificación del sistema y del celular, uno por producto, y además se
// repetían cada vez que se guardaba un producto con 10 o menos existencias
// aunque nadie las hubiera tocado. Eran muy invasivos en PC y celular.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { vaComoPush, cruceDeExistencias } = await import('../../src/utils/avisos-solo-campana.mjs');

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('los avisos de inventario no salen como push; los demás sí', () => {
  [
    'producto_sin_stock',
    'producto_stock_bajo',
    'producto_disponible_nuevamente',
    'producto_publicado',
  ].forEach((tipo) => assert.equal(vaComoPush(tipo), false, tipo));
  ['mensaje_chat', 'solicitud_cambio', 'cumpleanos'].forEach((tipo) =>
    assert.equal(vaComoPush(tipo), true, tipo)
  );
});

test('guardar sin cruzar el umbral no vuelve a avisar', () => {
  assert.equal(cruceDeExistencias({ antes: 0, despues: 0 }), null);
  assert.equal(cruceDeExistencias({ antes: 5, despues: 5 }), null);
  assert.equal(cruceDeExistencias({ antes: 8, despues: 3 }), null);
  assert.equal(cruceDeExistencias({ antes: 30, despues: 20 }), null);
});

test('cruzar el umbral avisa una vez', () => {
  assert.equal(cruceDeExistencias({ antes: 3, despues: 0 }), 'producto_sin_stock');
  assert.equal(cruceDeExistencias({ antes: 20, despues: 10 }), 'producto_stock_bajo');
  assert.equal(cruceDeExistencias({ antes: 0, despues: 4 }), 'producto_disponible_nuevamente');
  assert.equal(cruceDeExistencias({ antes: null, despues: 0 }), 'producto_sin_stock');
});

test('el cliente y el servidor respetan la lista', async () => {
  assert.match(
    await leer('src/services/notification-service.js'),
    /vaComoPush\(notificacionConfigurada\.tipoNotificacion\)/
  );
  assert.match(
    await leer('src/app/api/push/notificacion/route.js'),
    /vaComoPush\(notificacion\.tipoNotificacion\)/
  );
  assert.match(await leer('src/services/product-service.js'), /cruceDeExistencias\(/);
});
