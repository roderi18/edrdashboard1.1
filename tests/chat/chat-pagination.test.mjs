import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildConversationPage,
  normalizeChatPageSize,
  decodeConversationCursor,
  encodeConversationCursor,
} from '../../src/server/chat-pagination.mjs';

test('normaliza el tamaño de página y aplica el límite operativo', () => {
  assert.equal(normalizeChatPageSize(), 30);
  assert.equal(normalizeChatPageSize('20'), 20);
  assert.equal(normalizeChatPageSize(500), 100);
  assert.equal(normalizeChatPageSize(-1), 30);
});

test('el cursor conserva fecha e identificador sin aceptar valores inválidos', () => {
  const cursor = encodeConversationCursor({
    idConversacion: 'conversacion-42',
    actualizadoEn: '2026-08-06T15:00:00.000Z',
  });

  assert.deepEqual(decodeConversationCursor(cursor), {
    id: 'conversacion-42',
    actualizadoEn: '2026-08-06T15:00:00.000Z',
  });
  assert.equal(decodeConversationCursor('cursor-invalido'), null);
});

test('crea páginas estables con un elemento centinela', () => {
  const source = Array.from({ length: 31 }, (_, index) => ({
    idConversacion: `c-${index}`,
    actualizadoEn: new Date(Date.UTC(2026, 7, 6, 15, 0, 31 - index)).toISOString(),
  }));
  const page = buildConversationPage({ conversations: source, pageSize: 30 });

  assert.equal(page.conversations.length, 30);
  assert.equal(page.hasMore, true);
  assert.deepEqual(decodeConversationCursor(page.nextCursor), {
    id: 'c-29',
    actualizadoEn: source[29].actualizadoEn,
  });
});
