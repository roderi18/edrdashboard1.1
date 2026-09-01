import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buscarEmojis,
  nombreDelEmoji,
  CATEGORIAS_EMOJI,
  TODOS_LOS_EMOJIS,
} from '../../src/catalogs/emojis.mjs';

test('todos los emojis tienen nombre en español', () => {
  const sinNombre = TODOS_LOS_EMOJIS.filter((entrada) => !entrada.nombre?.trim());

  assert.deepEqual(sinNombre, []);
  assert.ok(TODOS_LOS_EMOJIS.length > 600, 'el catalogo se quedo corto');
  assert.equal(CATEGORIAS_EMOJI.length, 11);
});

// Quien busca "corazon" tiene que encontrar "corazón". Sin esto, la mitad de los
// nombres serian inalcanzables desde un teclado sin tildes.
test('la busqueda ignora tildes y mayusculas', () => {
  assert.ok(buscarEmojis('corazon').some((e) => e.emoji === '❤️'));
  assert.ok(buscarEmojis('CORAZÓN').some((e) => e.emoji === '❤️'));
  assert.ok(buscarEmojis('piña').some((e) => e.emoji === '🍍'));
  assert.ok(buscarEmojis('PIÑA').some((e) => e.emoji === '🍍'));
});

// Nadie escribe "cara con lagrimas de alegria": escribe "risa".
test('se encuentra por como lo llama la gente, no solo por su nombre oficial', () => {
  assert.ok(buscarEmojis('risa').some((e) => e.emoji === '😂'));
  assert.ok(buscarEmojis('futbol').some((e) => e.emoji === '⚽'));
  assert.ok(buscarEmojis('ok').some((e) => e.emoji === '👍'));
  assert.ok(buscarEmojis('dominicana').some((e) => e.emoji === '🇩🇴'));
});

// "cara triste" no puede devolver todas las caras Y todo lo triste: solo lo que
// es las dos cosas.
test('varias palabras se exigen todas', () => {
  const resultado = buscarEmojis('cara triste');

  assert.ok(resultado.length > 0);
  assert.ok(resultado.every((e) => e.busqueda.includes('cara') && e.busqueda.includes('triste')));
});

test('sin texto no devuelve nada, y lo que no existe tampoco', () => {
  assert.deepEqual(buscarEmojis(''), []);
  assert.deepEqual(buscarEmojis('   '), []);
  assert.deepEqual(buscarEmojis('zzzqqq'), []);
});

test('el nombre se puede consultar por el emoji', () => {
  assert.equal(nombreDelEmoji('😂'), 'cara llorando de risa');
  assert.equal(nombreDelEmoji('👍'), 'pulgar hacia arriba');
  // Uno que no esta en la lista se devuelve tal cual, sin reventar.
  assert.equal(nombreDelEmoji('🫥'), '🫥');
});
