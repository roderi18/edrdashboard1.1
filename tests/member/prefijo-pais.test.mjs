import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABREVIATURAS_PAIS,
  PREFIJO_PAIS_POR_DEFECTO,
  normalizarAbreviaturaPais,
} from '../../src/catalogs/provincias-abreviaturas.js';

// `RD` esta retirada: la tabla viva de Firestore todavia puede traerla, y de ahi
// salian codigos `RD-SD-NNNNN` que ademas reiniciaban la cuenta en 10001.
test('la abreviatura retirada RD se traduce a DO', () => {
  assert.equal(normalizarAbreviaturaPais('RD'), 'DO');
  assert.equal(normalizarAbreviaturaPais(' rd '), 'DO');
});

test('el resto de abreviaturas pasan tal cual, en mayusculas', () => {
  assert.equal(normalizarAbreviaturaPais('do'), 'DO');
  assert.equal(normalizarAbreviaturaPais('PA'), 'PA');
  assert.equal(normalizarAbreviaturaPais(''), '');
  assert.equal(normalizarAbreviaturaPais(null), '');
});

test('el catalogo local ya no emite RD', () => {
  assert.equal(PREFIJO_PAIS_POR_DEFECTO, 'DO');
  assert.equal(Object.values(ABREVIATURAS_PAIS).includes('RD'), false);
});
