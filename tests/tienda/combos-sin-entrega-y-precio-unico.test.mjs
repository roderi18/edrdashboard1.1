// ----------------------------------------------------------------------
// UN COMBO DE CAMPAMENTO: SIN ENTREGA, Y UN SOLO PRECIO.
//
// Qué se rompía:
//   1. Pagar una inscripción pedía dirección y ofrecía envío "Expreso": un combo
//      se recoge en la actividad.
//   2. El editor visual del Designer escribía el precio del banner como texto:
//      la portada decía RD$800 y el carrito cobraba RD$3,500. Ahora el precio se
//      cambia en el producto (lo que se cobra) y todo lo lee de ahí.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../soporte/resolver-alias-src.mjs';

const { itemDeCarritoDeCombo, carritoSinEntrega } =
  await import('../../src/utils/combos-de-actividad.mjs');
const { precioValido, camposDelNuevoPrecio } =
  await import('../../src/utils/precio-de-producto.mjs');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('las líneas de un combo van marcadas sin entrega', () => {
  assert.equal(itemDeCarritoDeCombo({ id: 'c', price: 10 }, 1).sinEntrega, true);
});

test('solo un carrito entero de combos se salta dirección y entrega', () => {
  const combo = itemDeCarritoDeCombo({ id: 'c', price: 10 }, 1);

  assert.equal(carritoSinEntrega([combo]), true);
  assert.equal(carritoSinEntrega([combo, { id: 'gorra', price: 5 }]), false);
  assert.equal(carritoSinEntrega([]), false);
});

test('el pago sin entrega no pinta entrega ni dirección, y el envío es 0', () => {
  const pago = leer('src/sections/checkout/checkout-payment.jsx');
  const proveedor = leer('src/sections/checkout/context/checkout-provider.jsx');

  assert.match(pago, /!sinEntrega && \(\s*<CheckoutDelivery/);
  assert.match(pago, /!sinEntrega && \(\s*<CheckoutBillingInfo/);
  assert.match(proveedor, /carritoSinEntrega\(items\) \? 0/);
  assert.match(proveedor, /PASOS_SIN_ENTREGA = \['Carrito', 'Pago'\]/);
});

test('el precio escrito se entiende con o sin RD$ y comas', () => {
  assert.equal(precioValido('RD$1,500'), 1500);
  assert.equal(precioValido('800'), 800);
  assert.equal(precioValido('abc'), null);
  assert.equal(precioValido('-5'), null);
  assert.equal(precioValido(''), null);
});

test('los precios de miembro siguen al de lista solo si eran iguales', () => {
  assert.deepEqual(
    camposDelNuevoPrecio({ precio: 3500, precioRegistrado: 3500, precioNoRegistrado: 0 }, 800),
    { precio: 800, precioRegistrado: 800, precioNoRegistrado: 800 }
  );
  assert.deepEqual(
    camposDelNuevoPrecio({ precio: 3500, precioRegistrado: 3000, precioNoRegistrado: 3500 }, 800),
    { precio: 800, precioNoRegistrado: 800 }
  );
});

test('el banner marca el precio y el lienzo no lo tapa con texto', () => {
  const banner = leer('src/sections/principal/combos-del-banner.jsx');
  const lienzo = leer('src/sections/principal/lienzo-del-bloque.jsx');
  const editor = leer('src/sections/everest/editor-visual-universal.jsx');

  assert.match(banner, /data-precio-producto=\{combo\.id\}/);
  assert.match(lienzo, /estilo\.texto !== undefined && !elemento\.closest\(MARCA_DE_PRECIO\)/);
  assert.match(editor, /actualizarPrecioProductoFirestore/);
});
