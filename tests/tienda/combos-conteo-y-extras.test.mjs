// ----------------------------------------------------------------------
// LOS COMBOS LLEVAN CONTEO REGRESIVO, LO QUE INCLUYEN Y EXTRAS OPCIONALES.
//
// La pantalla "Inscribirme" solo tenía foto, nombre, precio y cantidad. Ahora
// cada combo cierra su venta en una fecha (conteo regresivo; pasada, "Cerrado"),
// dice lo que incluye y ofrece extras —otros productos de la tienda, como el
// parche de edición especial o los pines del evento—, uno por combo elegido.
// Todo opcional: un combo sin esos datos se pinta como antes.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  sanearCombo,
  comboAbierto,
  pedidoDeCombos,
  tiempoRestante,
  extrasDelCombo,
  cantidadDeExtra,
} = await import('../../src/utils/combos-de-actividad.mjs');
const { crearDocumentoProducto, mapearProductoFirestoreAUi } =
  await import('../../src/models/product-model.js');

const AHORA = Date.parse('2026-10-01T12:00:00Z');

const parche = { id: 'parche', name: 'Parche especial', price: 300, available: 1 };
const pines = { id: 'pines', name: 'Pines', price: 250, available: 20 };
const plus = {
  id: 'plus',
  name: 'Combo Plus',
  price: 3500,
  available: 5,
  combo: {
    etiqueta: 'Combo Plus',
    numero: 1,
    finVenta: '2026-10-03T18:30:15Z',
    incluye: [
      { tipo: 'camiseta', texto: 'Camiseta' },
      { tipo: 'raro', texto: 'Algo' },
    ],
    extras: [{ productoId: 'parche' }, { productoId: 'pines' }, { productoId: 'no-existe' }],
  },
};
const completo = {
  id: 'completo',
  name: 'Combo Completo',
  price: 2500,
  available: 5,
  combo: { extras: [{ productoId: 'pines' }, { productoId: 'parche' }] },
};

test('el conteo regresivo parte lo que falta en días, horas, minutos y segundos', () => {
  assert.deepEqual(tiempoRestante('2026-10-03T18:30:15Z', AHORA), {
    cerrado: false,
    dias: 2,
    horas: 6,
    minutos: 30,
    segundos: 15,
  });
  assert.equal(tiempoRestante(null, AHORA), null);
  assert.equal(tiempoRestante('2026-09-30T00:00:00Z', AHORA).cerrado, true);
});

test('pasada la fecha de cierre, o sin existencias, el combo no se puede pedir', () => {
  assert.equal(comboAbierto(plus, AHORA), true);
  assert.equal(comboAbierto(plus, Date.parse('2026-10-04T00:00:00Z')), false);
  assert.equal(comboAbierto({ ...plus, available: 0 }, AHORA), false);
  assert.equal(comboAbierto({ id: 'x', available: 3 }, AHORA), true);
});

test('lo roto del combo se queda fuera sin romper el combo', () => {
  const limpio = sanearCombo({
    numero: -2,
    finVenta: 'mañana',
    incluye: [{ tipo: 'raro', texto: 'Algo' }, {}],
  });
  assert.equal(limpio.numero, null);
  assert.equal(limpio.finVenta, null);
  assert.deepEqual(limpio.incluye, [{ tipo: 'otro', texto: 'Algo' }]);
  assert.equal(sanearCombo(null), null);
});

test('los extras son productos de la tienda; los que no existen no salen', () => {
  assert.deepEqual(
    extrasDelCombo(plus, [plus, parche, pines]).map(({ producto }) => producto.id),
    ['parche', 'pines']
  );
});

test('cada extra lleva su contador: suma por unidad, sin pasar de lo que hay', () => {
  // Antes era un interruptor que ponía uno por combo; ahora se elige cuántos.
  assert.equal(cantidadDeExtra({ cantidadCombo: 1, pedidos: 3, extra: pines }), 3);
  assert.equal(cantidadDeExtra({ cantidadCombo: 1, pedidos: 0, extra: pines }), 0);
  assert.equal(cantidadDeExtra({ cantidadCombo: 2, pedidos: 4, extra: parche }), 1);
  // Son extras DEL combo: sin el combo no cuentan.
  assert.equal(cantidadDeExtra({ cantidadCombo: 0, pedidos: 3, extra: pines }), 0);
});

test('el total suma combos y extras pedidos, y un extra pedido dos veces va en una línea', () => {
  const pedido = pedidoDeCombos({
    combos: [plus, completo],
    productos: [plus, completo, parche, pines],
    cantidades: { plus: 2, completo: 1 },
    cantidadesExtras: { 'plus:pines': 2, 'completo:pines': 1, 'plus:parche': 1 },
  });

  assert.equal(pedido.personas, 3);
  // 2 × 3500 + 1 × 2500 + 3 pines × 250 + 1 parche × 300
  assert.equal(pedido.total, 7000 + 2500 + 750 + 300);
  assert.equal(pedido.items.filter((item) => item.id === 'pines').length, 1);
});

test('el combo sobrevive a guardar el producto desde el formulario', () => {
  const documento = crearDocumentoProducto({ productoId: 'plus', data: plus });
  assert.equal(documento.combo.etiqueta, 'Combo Plus');
  assert.equal(mapearProductoFirestoreAUi(documento).combo.numero, 1);

  const formulario = fs.readFileSync(
    new URL('../../src/sections/product/product-create-edit-form.jsx', import.meta.url),
    'utf8'
  );
  assert.match(formulario, /combo: currentProduct\?\.combo \?\? null/);
});
