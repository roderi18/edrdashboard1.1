import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatReceipt,
  applyChatReceiptsToMessages,
} from '../../src/server/chat-receipts.mjs';

test('los recibos avanzan de forma monótona entre pestañas y dispositivos', () => {
  const receipt = buildChatReceipt({
    existing: {
      idMiembros: 84,
      entregadoHasta: '2026-08-06T12:10:00.000Z',
      leidoHasta: '2026-08-06T12:09:00.000Z',
    },
    idMiembros: 84,
    deliveredUntil: '2026-08-06T12:08:00.000Z',
    readUntil: '2026-08-06T12:11:00.000Z',
    now: '2026-08-06T12:12:00.000Z',
  });

  assert.equal(receipt.entregadoHasta, '2026-08-06T12:11:00.000Z');
  assert.equal(receipt.leidoHasta, '2026-08-06T12:11:00.000Z');
});

test('distingue enviado, entregado y visto por participante', () => {
  const message = {
    id: 'mensaje-1',
    senderId: '42',
    createdAt: '2026-08-06T12:00:00.000Z',
  };

  const sent = applyChatReceiptsToMessages({ messages: [message], participantIds: [42, 84] });
  const delivered = applyChatReceiptsToMessages({
    messages: [message],
    participantIds: [42, 84],
    receipts: [{ idMiembros: 84, entregadoHasta: '2026-08-06T12:01:00.000Z' }],
  });
  const seen = applyChatReceiptsToMessages({
    messages: [message],
    participantIds: [42, 84],
    receipts: [{
      idMiembros: 84,
      entregadoHasta: '2026-08-06T12:01:00.000Z',
      leidoHasta: '2026-08-06T12:02:00.000Z',
    }],
  });

  assert.equal(sent[0].deliveryStatus, 'enviado');
  assert.equal(delivered[0].deliveryStatus, 'entregado');
  assert.equal(seen[0].deliveryStatus, 'visto');
  assert.deepEqual(seen[0].seenByMemberIds, [84]);
});

test('un grupo solo queda visto cuando todos los destinatarios lo leyeron', () => {
  const [message] = applyChatReceiptsToMessages({
    messages: [{ senderId: 42, createdAt: '2026-08-06T12:00:00.000Z' }],
    participantIds: [42, 84, 99],
    receipts: [
      { idMiembros: 84, entregadoHasta: '2026-08-06T12:01:00.000Z', leidoHasta: '2026-08-06T12:01:00.000Z' },
      { idMiembros: 99, entregadoHasta: '2026-08-06T12:01:00.000Z' },
    ],
  });

  assert.equal(message.deliveryStatus, 'entregado');
  assert.deepEqual(message.seenByMemberIds, [84]);
});
