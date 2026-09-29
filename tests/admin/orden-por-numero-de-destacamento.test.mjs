// Qué se rompía: /dashboard/level/dest salía por nombre; se pidió por número,
// y comparado como texto "189" iba antes que "46".
import test from 'node:test';
import assert from 'node:assert/strict';

import { compararPorNumeroDeDestacamento } from '../../src/utils/orden-por-numero-de-destacamento.mjs';

test('ordena por número como número y deja los sin número al final', () => {
  const lista = [
    { destNumber: '189', name: 'B' },
    { destNumber: '', name: 'Sin número' },
    { destNumber: '46', name: 'A' },
    { destNumber: '5', name: 'C' },
  ];
  assert.deepEqual(
    [...lista].sort(compararPorNumeroDeDestacamento).map((d) => d.destNumber),
    ['5', '46', '189', '']
  );
});
