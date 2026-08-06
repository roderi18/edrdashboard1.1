import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ChatGroupError,
  getChatGroupRole,
  updateChatGroupDetails,
  validateChatGroupRemoval,
  transferChatGroupOwnership,
  updateChatGroupAdministrator,
} from '../../src/server/chat-group-core.mjs';

const group = {
  tipoConversacion: 'GRUPAL',
  participantesIds: [42, 84, 99, 100],
  creadoPorIdMiembros: 42,
  administradoresIds: [42, 84],
  nombreGrupo: 'Equipo regional',
};

test('distingue creador, administrador, miembro y usuario ajeno', () => {
  assert.equal(getChatGroupRole(group, 42), 'creator');
  assert.equal(getChatGroupRole(group, 84), 'admin');
  assert.equal(getChatGroupRole(group, 99), 'member');
  assert.equal(getChatGroupRole(group, 777), 'outsider');
});

test('administrador retira miembro, pero no a otro administrador', () => {
  assert.deepEqual(
    validateChatGroupRemoval({ conversation: group, actorIdMiembros: 84, targetIdMiembros: 99 }),
    { participantesIds: [42, 84, 100], administradoresIds: [42, 84], targetId: 99 }
  );
  assert.throws(
    () => validateChatGroupRemoval({ conversation: group, actorIdMiembros: 84, targetIdMiembros: 42 }),
    ChatGroupError
  );
});

test('miembro puede abandonar, salvo que deje menos de dos participantes', () => {
  const result = validateChatGroupRemoval({
    conversation: group,
    actorIdMiembros: 99,
    targetIdMiembros: 99,
  });
  assert.deepEqual(result.participantesIds, [42, 84, 100]);
  assert.throws(
    () => validateChatGroupRemoval({
      conversation: { ...group, participantesIds: [42, 99], administradoresIds: [42] },
      actorIdMiembros: 99,
      targetIdMiembros: 99,
    }),
    (error) => error.code === 'CHAT_GROUP_MIN_PARTICIPANTS'
  );
});

test('creador transfiere propiedad sin perder la administración', () => {
  assert.deepEqual(
    transferChatGroupOwnership({ conversation: group, actorIdMiembros: 42, targetIdMiembros: 99 }),
    { creadoPorIdMiembros: 99, administradoresIds: [42, 84, 99] }
  );
});

test('solo creador promueve o degrada administradores y nunca degrada al creador', () => {
  assert.deepEqual(
    updateChatGroupAdministrator({
      conversation: group,
      actorIdMiembros: 42,
      targetIdMiembros: 99,
      makeAdmin: true,
    }).administradoresIds,
    [42, 84, 99]
  );
  assert.throws(
    () => updateChatGroupAdministrator({
      conversation: group,
      actorIdMiembros: 42,
      targetIdMiembros: 42,
      makeAdmin: false,
    }),
    ChatGroupError
  );
});

test('administrador actualiza nombre y avatar con validación', () => {
  assert.deepEqual(
    updateChatGroupDetails({
      conversation: group,
      actorIdMiembros: 84,
      name: '  Consejo regional  ',
      avatarUrl: 'https://example.com/grupo.webp',
    }),
    { nombreGrupo: 'Consejo regional', avatarGrupoUrl: 'https://example.com/grupo.webp' }
  );
  assert.throws(
    () => updateChatGroupDetails({
      conversation: group,
      actorIdMiembros: 84,
      name: 'X',
      avatarUrl: 'http://inseguro.test/a.png',
    }),
    ChatGroupError
  );
});
