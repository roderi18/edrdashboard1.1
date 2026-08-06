import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatDraftKey,
  resolveMentionIds,
  searchChatDirectory,
  getNextUnreadConversationId,
} from '../../src/sections/chat/utils/productivity.mjs';

test('aísla borradores por miembro y conversación', () => {
  assert.equal(
    buildChatDraftKey({ currentMemberId: 42, conversationId: 'chat-7' }),
    'chat-draft:v1:42:conversation:chat-7'
  );
  assert.equal(
    buildChatDraftKey({ currentMemberId: 42, recipientIds: [9, 7, 9] }),
    'chat-draft:v1:42:compose:7,9'
  );
});

test('resuelve menciones por nombre y deduplica miembros', () => {
  assert.deepEqual(
    resolveMentionIds('Hola @Álanna Donald y @Roderi Peña', [
      { idMiembros: 84, name: 'Alanna Donald' },
      { idMiembros: 99, name: 'Roderi Peña' },
    ]),
    [84, 99]
  );
});

test('busca contactos, conversaciones y últimos mensajes sin datos sensibles', () => {
  const result = searchChatDirectory({
    query: 'fogata',
    currentMemberId: 42,
    contacts: [{ id: '84', name: 'Alanna Donald', codigoMiembro: 'do-sd-84' }],
    conversations: {
      allIds: ['c1'],
      byId: {
        c1: {
          participants: [{ id: '84', name: 'Alanna Donald' }],
          messages: [{ body: 'Fogata el sábado' }],
        },
      },
    },
  });

  assert.equal(result.contacts.length, 0);
  assert.equal(result.conversations.length, 1);
});

test('navega circularmente entre conversaciones no leídas', () => {
  const source = {
    allIds: ['c1', 'c2', 'c3'],
    byId: { c1: { unreadCount: 0 }, c2: { unreadCount: 2 }, c3: { unreadCount: 1 } },
  };

  assert.equal(getNextUnreadConversationId({ ...source, currentId: 'c2' }), 'c3');
  assert.equal(
    getNextUnreadConversationId({ ...source, currentId: 'c2', direction: -1 }),
    'c3'
  );
});
