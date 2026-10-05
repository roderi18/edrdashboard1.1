// ----------------------------------------------------------------------
// "INSCRIBIRME": TALLAS, ADICIONALES Y RESUMEN.
//
// Los combos llevan camiseta, pero nadie decía de qué talla. Ahora el paso 2
// reparte las tallas de TODAS las camisetas de los combos elegidos en un solo
// recuadro (las camisetas son iguales en todos los combos: antes salía uno por
// combo), sin que sobre ninguna, y ofrece camisetas y parches adicionales con
// pago aparte. El reparto se asigna a cada combo para que su línea diga qué
// tallas lleva ("M×2 · L×1"), que es lo que la orden guarda; el carrito suma los
// repartos si junta dos líneas.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  necesitaTallas,
  tallasDelCombo,
  textoDeTallas,
  maximoDeTalla,
  combinarTallas,
  estadoDeTallas,
  pedidoDeCombos,
  parcheAdicionalDe,
  camisetaAdicionalDe,
  TALLAS_POR_DEFECTO,
  repartirTallasEntreCombos,
} = await import('../../src/utils/combos-de-actividad.mjs');

const incluye = [{ tipo: 'camiseta', texto: 'Camiseta' }];
const plus = { id: 'plus', name: 'Combo Plus', price: 3500, available: 5, combo: { incluye } };
const basico = {
  id: 'basico',
  name: 'Combo Básico',
  price: 1500,
  available: 5,
  combo: { incluye },
};
const sinCamiseta = { id: 'solo', name: 'Solo inscripción', price: 800, available: 5, combo: null };

test('solo piden talla los combos que incluyen camiseta', () => {
  assert.equal(necesitaTallas(plus), true);
  assert.equal(necesitaTallas(sinCamiseta), false);
});

test('las tallas son las del producto o las de la ficha del miembro (6 a 16 y S a XXL)', () => {
  assert.deepEqual(TALLAS_POR_DEFECTO, [
    '6',
    '8',
    '10',
    '12',
    '14',
    '16',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
  ]);
  assert.deepEqual(tallasDelCombo(plus), TALLAS_POR_DEFECTO);
  assert.deepEqual(tallasDelCombo({ ...plus, sizes: ['10', '12', ' '] }), ['10', '12']);
});

test('un solo recuadro para todas las camisetas de los combos', () => {
  const cantidades = { plus: 2, basico: 3, solo: 1 };
  const estado = estadoDeTallas({
    combos: [plus, basico, sinCamiseta],
    cantidades,
    tallas: { M: 4 },
  });

  assert.equal(estado.filas.length, 2);
  assert.equal(estado.unidades, 5);
  assert.equal(estado.faltan, 1);
  assert.equal(estado.completo, false);
  assert.equal(
    estadoDeTallas({ combos: [plus, basico], cantidades, tallas: { M: 4, L: 1 } }).completo,
    true
  );
  assert.equal(estadoDeTallas({ combos: [plus], cantidades: {}, tallas: {} }).hacenFalta, false);
});

test('no pueden sobrar tallas: el contador no pasa de las camisetas de los combos', () => {
  assert.equal(maximoDeTalla({ unidades: 3, reparto: { M: 2 }, talla: 'M' }), 3);
  assert.equal(maximoDeTalla({ unidades: 3, reparto: { M: 2 }, talla: 'L' }), 1);
  assert.equal(maximoDeTalla({ unidades: 3, reparto: { M: 2, L: 1 }, talla: 'S' }), 0);
});

test('el reparto común se asigna por orden a cada combo y viaja en su línea', () => {
  const cantidades = { plus: 2, basico: 3 };
  const reparto = { M: 3, L: 2 };

  assert.deepEqual(repartirTallasEntreCombos({ combos: [plus, basico], cantidades, reparto }), {
    plus: { M: 2 },
    basico: { M: 1, L: 2 },
  });

  const { items } = pedidoDeCombos({
    combos: [plus, basico],
    productos: [plus, basico],
    cantidades,
    tallas: reparto,
  });
  assert.equal(items.find((item) => item.id === 'plus').size, 'M×2');
  assert.equal(items.find((item) => item.id === 'basico').size, 'M×1 · L×2');
  assert.equal(textoDeTallas({ XL: 1, S: 2 }), 'S×2 · XL×1');
});

test('camisetas y parches adicionales: con pago aparte, en su propia línea', () => {
  const camiseta = { id: 'camiseta', name: 'Camiseta adicional', price: 500, available: 50 };
  const parche = { id: 'parche', name: 'Parche adicional', price: 200, available: 50 };
  const combo = {
    ...plus,
    combo: { incluye, camisetaAdicional: 'camiseta', parcheAdicional: 'parche' },
  };
  const productos = [combo, camiseta, parche];

  assert.equal(camisetaAdicionalDe({ combos: [combo], cantidades: {}, productos }), null);
  assert.equal(
    camisetaAdicionalDe({ combos: [combo], cantidades: { plus: 1 }, productos }),
    camiseta
  );
  assert.equal(parcheAdicionalDe({ combos: [combo], cantidades: { plus: 1 }, productos }), parche);

  const { items, total } = pedidoDeCombos({
    combos: [combo],
    productos,
    cantidades: { plus: 1 },
    tallas: { M: 1 },
    adicionales: {
      camiseta: { producto: camiseta, reparto: { S: 1, L: 2 } },
      parche: { producto: parche, cantidad: 2 },
    },
  });

  assert.equal(items.find((item) => item.id === 'camiseta').size, 'S×1 · L×2');
  assert.equal(items.find((item) => item.id === 'parche').quantity, 2);
  assert.equal(total, 3500 + 3 * 500 + 2 * 200);
});

test('el carrito suma los repartos al juntar dos líneas del mismo combo', () => {
  assert.deepEqual(combinarTallas({ M: 2 }, { M: 1, L: 1 }), { M: 3, L: 1 });

  const carrito = readFileSync(
    new URL('../../src/sections/checkout/context/checkout-provider.jsx', import.meta.url),
    'utf8'
  );
  assert.match(carrito, /combinarTallas\(item\.tallas, newItem\.tallas\)/);
});
