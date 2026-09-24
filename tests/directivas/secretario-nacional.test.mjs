// ----------------------------------------------------------------------
// EL SECRETARIO NACIONAL TIENE CASILLA EN EL ORGANIGRAMA.
//
// Qué se rompía: el organigrama nacional no tenía casilla de Secretario, así que
// el de 2022-2026 (Bismal Canela) solo salía en la lista y nunca en el árbol.
// Ahora va en la fila del Consejo Ejecutivo, justo antes de Oficiales
// Especiales, y la memoria guardada sin casilla se reconoce por su cargo.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ocupanteHistorico, posicionDelCargo } = await import('src/utils/directiva-cuatrienios.mjs');
const { NATIONAL_LEADERSHIP_DATA } = await import('src/catalogs/directiva-diagrams.js');

const buscarNodo = (nodo, id) =>
  nodo?.id === id ? nodo : (nodo?.children || []).map((hijo) => buscarNodo(hijo, id)).find(Boolean);

test('la casilla va en la fila del Consejo Ejecutivo, justo antes de Oficiales Especiales', () => {
  const fila = buscarNodo(NATIONAL_LEADERSHIP_DATA, 'consejo-ejecutivo').children.map(
    (nodo) => nodo.id
  );

  assert.equal(fila.indexOf('secretario-nacional'), fila.indexOf('comites-especiales') - 1);
});

test('el cargo "secretario" de la nacional tiene posición en el catálogo', () => {
  assert.equal(posicionDelCargo('nacional', 'secretario'), 'nacional-secretario-nacional');
});

test('la memoria guardada sin casilla se pinta en la casilla por su cargo', () => {
  const filas = [
    {
      grupo: 'directiva',
      cargo: 'secretario',
      idPosicionDirectiva: null,
      nombres: 'Bismal',
      apellidos: 'Canela',
    },
  ];

  assert.equal(ocupanteHistorico(filas, 'nacional', 'secretario-nacional')?.name, 'Bismal Canela');
});

test('un oficial sin casilla no se cuela en la del secretario', () => {
  const filas = [{ grupo: 'oficiales', cargo: 'secretario', nombres: 'Otro', apellidos: 'Nombre' }];

  assert.equal(ocupanteHistorico(filas, 'nacional', 'secretario-nacional'), null);
});
