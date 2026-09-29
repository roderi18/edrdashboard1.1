// Qué se rompía: el padrón trae números repetidos ("Destacamento 280" y
// "Destacamento 280 · Leones de Judá") y la lista del formulario enseñaba los
// dos. Debe quedar uno por número: el que tiene nombre.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  destacamentoQueQueda,
  destacamentosSinDuplicados,
} from '../src/utils/destacamentos-sin-duplicados.mjs';

const lista = [
  { id: 10, numero: '280', nombre: '' },
  { id: 11, numero: '280', nombre: 'Destamento "Leones de Judá"' },
  { id: 12, numero: '281', nombre: 'Águilas' },
  { id: 13, numero: '', nombre: 'Sin número A' },
  { id: 14, numero: '', nombre: 'Sin número B' },
  { id: 15, numero: '300', nombre: 'Viejo' },
  { id: 16, numero: '300', nombre: 'Nuevo' },
];

test('de dos con el mismo número queda el que tiene nombre', () => {
  const ids = destacamentosSinDuplicados(lista).map((d) => d.id);
  assert.ok(ids.includes(11));
  assert.ok(!ids.includes(10));
});

test('si los dos tienen nombre queda el más reciente, y los sin número no se juntan', () => {
  assert.deepEqual(destacamentosSinDuplicados(lista).map((d) => d.id), [11, 12, 13, 14, 16]);
});

test('quien estaba en el repetido quitado cae en el que queda', () => {
  assert.equal(destacamentoQueQueda(lista, 10).id, 11);
  assert.equal(destacamentoQueQueda(lista, 12).id, 12);
  assert.equal(destacamentoQueQueda(lista, 99), null);
});
