import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_PERMISSIONS,
  CHAT_AUTHORIZATION_CODES,
  assertChatPermission,
  assertMessageAuthor,
  assertConversationCreator,
  assertConversationParticipant,
  authorizeConversationOperation,
} from '../../src/server/chat-authorization-core.mjs';

const conversation = {
  participantesIds: [10, 20],
  creadoPorIdMiembros: 10,
};

const expectAuthorizationCode = (callback, code) => {
  assert.throws(callback, (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, code);
    return true;
  });
};

test('permite leer una conversación únicamente a sus participantes', () => {
  assert.equal(assertConversationParticipant(conversation, { idMiembros: 20 }), 20);
  expectAuthorizationCode(
    () => assertConversationParticipant(conversation, { idMiembros: 99 }),
    CHAT_AUTHORIZATION_CODES.NOT_PARTICIPANT
  );
});

test('reserva la administración destructiva al creador participante', () => {
  assert.equal(assertConversationCreator(conversation, { idMiembros: 10 }), 10);
  expectAuthorizationCode(
    () => assertConversationCreator(conversation, { idMiembros: 20 }),
    CHAT_AUTHORIZATION_CODES.NOT_CREATOR
  );
});

test('editar, eliminar y restaurar se limitan al autor del mensaje', () => {
  assert.equal(
    assertMessageAuthor({ remitenteIdMiembros: 20 }, { idMiembros: 20 }),
    20
  );
  expectAuthorizationCode(
    () => assertMessageAuthor({ remitenteIdMiembros: 20 }, { idMiembros: 10 }),
    CHAT_AUTHORIZATION_CODES.NOT_MESSAGE_AUTHOR
  );
});

test('un permiso granular excluido bloquea la operación aunque sea participante', () => {
  const actor = {
    idMiembros: 20,
    profile: { permisosExcluidos: [CHAT_PERMISSIONS.SEND] },
  };

  expectAuthorizationCode(
    () =>
      authorizeConversationOperation({
        actor,
        conversation,
        permission: CHAT_PERMISSIONS.SEND,
      }),
    CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED
  );
});

test('chats.ver=false bloquea todo el módulo desde el servidor', () => {
  expectAuthorizationCode(
    () =>
      assertChatPermission(
        { profile: { permisos: { chats: { ver: false } } } },
        CHAT_PERMISSIONS.VIEW
      ),
    CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED
  );
});

test('los perfiles históricos conservan acceso salvo una denegación explícita', () => {
  assert.equal(assertChatPermission({ profile: {} }, CHAT_PERMISSIONS.SEND), true);
});
