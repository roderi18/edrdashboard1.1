// ----------------------------------------------------------------------
// LAS CATEGORÍAS DE CAMPAMENTO SE RENOMBRAN Y SE BORRAN DESDE EL DESPLEGABLE.
//
// Cada campamento tiene su categoría (la de sus combos) y su nombre cambia de
// un año a otro, pero una categoría añadida con "+ Nuevo" no se podía tocar.
// Ahora las que empiezan por "Campamento" llevan lápiz y papelera, solo para el
// Administrador Global y quien administra la tienda. Renombrar no cambia el id
// (productos y actividad siguen enlazados) y borrar se niega si algún producto
// la usa.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { esCategoriaDeCampamento } =
  await import('../../src/utils/producto-categorias-personalizadas.mjs');

const leer = (ruta) => fs.readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('solo las personalizadas que empiezan por "Campamento"', () => {
  const personalizada = (label) => ({ value: 'x', label, personalizada: true });

  assert.equal(esCategoriaDeCampamento(personalizada('Campamento Regional 2026')), true);
  assert.equal(esCategoriaDeCampamento(personalizada('campaménto nacional')), true);
  assert.equal(esCategoriaDeCampamento(personalizada('CAMPAMENTO de verano')), true);
  assert.equal(esCategoriaDeCampamento(personalizada('Campamentos especiales')), false);
  assert.equal(esCategoriaDeCampamento(personalizada('Pines')), false);
  // Las de fábrica no se tocan aunque se llamen así.
  assert.equal(esCategoriaDeCampamento({ value: 'campamentos', label: 'Campamento' }), false);
});

test('el servicio comprueba quién y qué, renombra sin tocar el id y no borra en uso', () => {
  const servicio = leer('src/services/producto-categorias-service.js');

  assert.match(servicio, /canManageStoreProducts\(usuario\) && !isAdminGlobal\(usuario\)/);
  assert.match(servicio, /esCategoriaDeCampamento\(categoria\)/);
  assert.match(servicio, /renombrarCategoriaProductoDoc\(categoria\.value, limpio\)/);
  assert.match(servicio, /productosConCategoria\(categoria\.value\)/);
  assert.match(servicio, /proponerCambio\(/);
});

test('el desplegable enseña lápiz y papelera solo a quien gestiona y solo en las de campamento', () => {
  const formulario = leer('src/sections/product/product-create-edit-form.jsx');

  assert.match(formulario, /puedeGestionarCategorias && esCategoriaDeCampamento\(classify\)/);
  assert.doesNotMatch(formulario, /select: \{ native: true \}[\s\S]{0,80}name="category"/);
});
