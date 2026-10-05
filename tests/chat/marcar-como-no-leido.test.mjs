// Qué faltaba: en /chats una conversación abierta quedaba leída y no había forma
// de dejarla pendiente. "Marcar como no leído" pone el contador de quien lo pide
// en 1, sin pisar los que ya tenía ni tocar el de los demás participantes.
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { conNoLeidoMarcado } = await import('src/utils/chat-no-leido.mjs');

test('una conversación leída queda con un pendiente para quien la marca', () => {
  assert.deepEqual(conNoLeidoMarcado({ 10: 0, 20: 3 }, 10), { 10: 1, 20: 3 });
});

test('sin contador previo también se marca', () => {
  assert.deepEqual(conNoLeidoMarcado(undefined, 20002), { 20002: 1 });
});

test('si ya tenía mensajes sin leer no se cambia nada', () => {
  assert.equal(conNoLeidoMarcado({ 10: 4 }, 10), null);
});

test('sin identidad no se marca', () => {
  assert.equal(conNoLeidoMarcado({ 10: 0 }, ''), null);
});
