// LA BANDEJA DICE CUÁNTAS VECES SE REPITIÓ UN DESTACAMENTO.
//
// Apache 206 mandó el formulario dos veces, con el coordinador escrito
// distinto, y en la bandeja no se notaba: se podían cargar los dos. Debajo de
// la fecha sale "Repetido x1", "x2"... según cuántas veces más llegó.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  textoRepetido,
  claveDeDestacamento,
  repeticionesPorEnvio,
} from '../../src/utils/actualizaciones-repetidas.mjs';

test('dos envíos del mismo destacamento dicen "Repetido x1" los dos', () => {
  const veces = repeticionesPorEnvio([
    { id: 'a', destacamento: { id: '290' } },
    { id: 'b', destacamento: { id: '290' } },
    { id: 'c', destacamento: { id: '459' } },
  ]);
  assert.deepEqual(veces, { a: 1, b: 1 });
  assert.equal(textoRepetido(veces.a), 'Repetido x1');
  assert.equal(textoRepetido(veces.c), '');
});

test('tres envíos dicen "Repetido x2"', () => {
  const veces = repeticionesPorEnvio(
    ['a', 'b', 'c'].map((id) => ({ id, destacamento: { id: 231 } }))
  );
  assert.equal(textoRepetido(veces.c), 'Repetido x2');
});

test('un destacamento nuevo se reconoce por nombre y número, sin tildes', () => {
  assert.equal(
    claveDeDestacamento({ nombreDestacamento: 'León', numeroDestacamento: '5' }),
    claveDeDestacamento({ nombreDestacamento: 'leon ', numeroDestacamento: '5' })
  );
  assert.notEqual(
    claveDeDestacamento({ nombreDestacamento: 'León', numeroDestacamento: '5' }),
    claveDeDestacamento({ nombreDestacamento: 'León', numeroDestacamento: '6' })
  );
});
