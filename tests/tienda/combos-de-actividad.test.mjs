// ----------------------------------------------------------------------
// INSCRIBIRSE AL CAMPAMENTO ES COMPRAR SUS COMBOS EN LA TIENDA.
//
// La tarjeta "Próxima actividad" de /principal solo llevaba a un enlace. Ahora
// "Inscribirme" ofrece los combos del campamento (productos de la tienda cuya
// categoría se llama como la actividad) y se puede llevar más de uno de cada.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  maximoDeCombo,
  claveDeActividad,
  combosDeActividad,
  itemDeCarritoDeCombo,
} from '../../src/utils/combos-de-actividad.mjs';

const productos = [
  {
    id: 'c',
    name: 'Combo Premium',
    category: 'campamento-regional-2026',
    price: 3500,
    available: 10,
  },
  {
    id: 'a',
    name: 'Combo Básico',
    category: 'campamento-regional-2026',
    price: 1500,
    available: 0,
  },
  { id: 'b', name: 'Combo Medio', category: 'campamento-regional-2026', price: 2500, available: 5 },
  { id: 'z', name: 'Borrador', category: 'campamento-regional-2026', price: 1, publish: 'draft' },
  { id: 'x', name: 'Gorra', category: 'accesorios', price: 500 },
];

test('los combos son los productos publicados con la categoría de la actividad, el más caro primero', () => {
  // El combo principal es el "1": antes salía el último, del más barato al más caro.
  const combos = combosDeActividad(productos, 'Campamento Regional 2026');
  assert.deepEqual(
    combos.map((c) => c.id),
    ['c', 'b', 'a']
  );
});

test('con número de combo manda el número', () => {
  const conNumero = productos.map((p) => (p.id === 'a' ? { ...p, combo: { numero: 1 } } : p));
  assert.deepEqual(
    combosDeActividad(conNumero, 'Campamento Regional 2026').map((c) => c.id),
    ['a', 'c', 'b']
  );
});

test('la categoría casa con el nombre de la actividad sin importar tildes ni mayúsculas', () => {
  assert.equal(claveDeActividad('Campamento Regional 2026'), 'campamento-regional-2026');
  assert.equal(claveDeActividad('Campaménto  REGIONAL 2026'), 'campamento-regional-2026');
});

test('sin categoría con ese nombre no hay combos (el botón lleva a su enlace)', () => {
  assert.deepEqual(combosDeActividad(productos, 'Alas de Bronce'), []);
});

test('se puede llevar más de uno, hasta lo que haya en existencia', () => {
  assert.equal(maximoDeCombo(productos[0]), 10);
  assert.equal(maximoDeCombo(productos[1]), 0);

  const item = itemDeCarritoDeCombo(productos[0], 3);
  assert.equal(item.quantity, 3);
  assert.equal(item.subtotal, 10500);
  assert.equal(item.id, 'c');
});

// Al cambiar el título de la actividad ("Campamento Regional Inquebrantables
// 2027") los combos dejaban de encontrarse e "Inscribirme" volvía al
// calendario. Con la categoría elegida en el Designer, manda esa.
test('con la categoría elegida en el Designer, el título no importa', () => {
  const combos = combosDeActividad(
    productos,
    'Campamento Regional Inquebrantables 2027',
    'campamento-regional-2026'
  );
  assert.deepEqual(
    combos.map((c) => c.id),
    ['c', 'b', 'a']
  );
  assert.deepEqual(combosDeActividad(productos, 'Campamento Regional Inquebrantables 2027'), []);
});
