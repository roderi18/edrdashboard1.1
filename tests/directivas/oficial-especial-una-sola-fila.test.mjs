// ----------------------------------------------------------------------
// EN LA LISTA DEL CONSEJO NACIONAL, UNA PERSONA ES UNA SOLA FILA.
//
// Qué se rompía: Stalin Peralta es Sub-Director Regional (Región Central) y
// Oficial Especial con el título "Coordinador tecnología". La lista "Todos" lo
// pintaba dos veces. Ahora va en la fila de su cargo regional, con el Oficial
// debajo de cada columna; también si el filtro solo encuentra la parte del
// Oficial (Consejo Ejecutivo).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';

import { unirOficialesConSuCargo } from '../../src/utils/consejo-nacional-filas.mjs';

const regional = {
  id: 'r1',
  memberId: 7,
  level: 'regional',
  nationalXMemberPosition: 'regional-subdirector-regional',
};
const oficial = {
  id: 'o1',
  memberId: 7,
  level: 'nacional',
  nationalXMemberPosition: 'nacional-oficial-especial-3',
};
const otro = {
  id: 'x',
  memberId: 9,
  level: 'nacional',
  nationalXMemberPosition: 'nacional-oficial-especial-1',
};
const todas = [oficial, otro, regional];

test('el Oficial Especial va dentro de la fila de su cargo regional', () => {
  const filas = unirOficialesConSuCargo(todas, todas);

  assert.deepEqual(
    filas.map((f) => f.id),
    ['r1', 'x']
  );
  assert.deepEqual(
    filas[0].adicionales.map((f) => f.id),
    ['o1']
  );
});

test('si el filtro solo deja la parte del Oficial, sale la persona en su fila unida', () => {
  const filas = unirOficialesConSuCargo([oficial], todas);

  assert.equal(filas.length, 1);
  assert.equal(filas[0].id, 'r1');
  assert.deepEqual(
    filas[0].adicionales.map((f) => f.id),
    ['o1']
  );
});

test('un Oficial sin cargo de región o sección sigue en su propia fila', () => {
  assert.deepEqual(unirOficialesConSuCargo([otro], todas), [otro]);
});
