import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getActiveTypingState,
  getConversationDeliveryMarker,
  mergeRealtimeMessageChanges,
} from '../../src/sections/chat/utils/realtime-sync.mjs';

const message = {
  id: 'm1',
  body: 'Hola',
  contentType: 'text',
  createdAt: '2026-08-06T12:00:00.000Z',
  senderId: '42',
  reactions: { 42: '👍' },
  deliveryStatus: 'visto',
  seenByMemberIds: [84],
};

test('aplica reacciones inmediatamente y conserva el estado de entrega', () => {
  const [updated] = mergeRealtimeMessageChanges({
    messages: [message],
    changes: [
      {
        id: 'm1',
        type: 'modified',
        data: {
          idMensaje: 'm1',
          texto: 'Hola',
          tipoContenido: 'text',
          enviadoEn: message.createdAt,
          remitenteIdMiembros: 42,
          reacciones: { 42: '👍', 84: '🎉' },
          estadoEntrega: 'enviado',
        },
      },
    ],
  });

  assert.deepEqual(updated.reactions, { 42: '👍', 84: '🎉' });
  assert.equal(updated.deliveryStatus, 'visto');
  assert.deepEqual(updated.seenByMemberIds, [84]);
});

test('un mensaje eliminado pierde todas sus reacciones en el receptor', () => {
  const [deleted] = mergeRealtimeMessageChanges({
    messages: [message],
    changes: [
      {
        id: 'm1',
        type: 'modified',
        data: {
          idMensaje: 'm1',
          texto: 'Mensaje eliminado',
          tipoContenido: 'text',
          enviadoEn: message.createdAt,
          remitenteIdMiembros: 42,
          eliminado: true,
          reacciones: { 42: '👍' },
        },
      },
    ],
  });

  assert.equal(deleted.eliminado, true);
  assert.deepEqual(deleted.reactions, {});
});

test('el snapshot inicial no reintroduce mensajes ocultos y los nuevos sí se agregan', () => {
  const hiddenInitial = mergeRealtimeMessageChanges({
    messages: [],
    changes: [{ id: 'viejo', type: 'added', data: { idMensaje: 'viejo', texto: 'Viejo' } }],
    allowInsert: false,
  });
  const withNewMessage = mergeRealtimeMessageChanges({
    messages: hiddenInitial,
    changes: [
      {
        id: 'nuevo',
        type: 'added',
        data: {
          idMensaje: 'nuevo',
          texto: 'Nuevo',
          enviadoEn: '2026-08-06T12:01:00.000Z',
        },
      },
    ],
  });

  assert.deepEqual(hiddenInitial, []);
  assert.equal(withNewMessage[0].id, 'nuevo');
});

test('el indicador de escritura calcula su vencimiento sin esperar otro snapshot', () => {
  const now = Date.parse('2026-08-06T12:00:03.000Z');
  const active = getActiveTypingState({
    typingByMember: {
      42: '2026-08-06T12:00:02.000Z',
      84: '2026-08-06T11:59:50.000Z',
      99: '2026-08-06T12:00:02.500Z',
    },
    currentMemberId: 99,
    now,
    staleMs: 4_000,
  });

  assert.deepEqual(active.ids, ['42']);
  assert.equal(active.expiresIn, 3_000);
});

test('solo confirma entrega de mensajes enviados por otro miembro', () => {
  const conversation = {
    actualizadoEn: '2026-08-06T12:00:01.000Z',
    ultimoMensaje: {
      idMensaje: 'm2',
      enviadoEn: '2026-08-06T12:00:00.000Z',
      remitenteIdMiembros: 42,
    },
  };

  assert.equal(getConversationDeliveryMarker({ conversation, currentMemberId: 42 }), null);
  assert.equal(
    getConversationDeliveryMarker({ conversation, currentMemberId: 84 }),
    'm2:2026-08-06T12:00:00.000Z'
  );
});
