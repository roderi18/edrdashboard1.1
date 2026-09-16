import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatDraftKey,
  resolveMentionIds,
  searchChatDirectory,
  moveMentionSelection,
  filterMentionCandidates,
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

test('@todos menciona a todos los participantes excepto a quien escribe', () => {
  assert.deepEqual(
    resolveMentionIds(
      'Atención @todos, revisen esto.',
      [
        { idMiembros: 42, name: 'Persona actual' },
        { idMiembros: 84, name: 'Alanna Donald' },
        { idMiembros: 99, name: 'Roderi Peña' },
      ],
      42
    ),
    [84, 99]
  );
});

test('las sugerencias de menciones excluyen al usuario actual y filtran sin tildes', () => {
  const candidates = filterMentionCandidates({
    participants: [
      { idMiembros: 10002, name: 'Roderi Daniel Peña Rosario' },
      { idMiembros: 10003, name: 'Matías David Pérez Ramos' },
      { idMiembros: 10004, name: 'Stalin Peralta' },
    ],
    query: 'matias',
    currentMemberId: 10002,
  });

  assert.deepEqual(candidates.map((candidate) => candidate.idMiembros), [10003]);

  const allCandidates = filterMentionCandidates({
    participants: [
      { idMiembros: 10002, name: 'Roderi Daniel Peña Rosario' },
      { idMiembros: 10003, name: 'Matías David Pérez Ramos' },
    ],
    query: '',
    currentMemberId: 10002,
  });

  assert.equal(allCandidates[0].mentionAll, true);
  assert.deepEqual(allCandidates.slice(1).map((candidate) => candidate.idMiembros), [10003]);
});

test('las flechas recorren circularmente las sugerencias de menciones', () => {
  assert.equal(moveMentionSelection({ currentIndex: 0, count: 3, direction: 1 }), 1);
  assert.equal(moveMentionSelection({ currentIndex: 2, count: 3, direction: 1 }), 0);
  assert.equal(moveMentionSelection({ currentIndex: 0, count: 3, direction: -1 }), 2);
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
