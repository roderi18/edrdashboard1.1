import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chatMessageToUi,
  CHAT_MESSAGE_MODEL_VERSION,
  ChatMessageValidationError,
  createChatMessageDocument,
  normalizeChatMessageEditText,
  normalizeChatReaction,
} from '../../src/server/chat-message-model.mjs';

const now = '2026-08-06T12:00:00.000Z';
const sender = { idMiembros: 42, name: 'Miembro de prueba', correo: 'privado@example.com' };
const create = (message, options = {}) =>
  createChatMessageDocument({
    message,
    fallbackSender: sender,
    conversationId: 'individual_42_84',
    now,
    randomUUID: () => 'mensaje-generado',
    ...options,
  });

const validFile = {
  id: 'documento-1',
  nombre: 'manual.pdf',
  nombreOriginal: 'Manual privado.pdf',
  tipo: 'application/pdf',
  tamano: 1024,
  tamanoOriginal: 2048,
  storagePath: 'chat/individual_42_84/archivos/1710000000-0-manual.pdf',
  url: 'https://firebasestorage.googleapis.com/v0/b/demo/o/manual.pdf?alt=media',
};

test('crea el contrato canónico versionado para mensajes de texto', () => {
  const document = create({ id: 'mensaje-1', body: '  Hola equipo  ', senderId: '42' });

  assert.equal(document.versionModelo, CHAT_MESSAGE_MODEL_VERSION);
  assert.equal(document.texto, 'Hola equipo');
  assert.equal(document.tipoContenido, 'text');
  assert.equal(document.remitenteIdMiembros, 42);
  assert.equal(document.remitente.idMiembros, 42);
  assert.equal(document.remitente.correo, undefined);
  assert.equal(document.estadoEntrega, 'enviado');
  assert.deepEqual(document.adjuntos, []);
  assert.deepEqual(document.mencionesIds, []);
});

test('rechaza mensajes vacíos y texto mayor de 20 000 caracteres', () => {
  assert.throws(() => create({ id: 'vacio', body: '   ' }), ChatMessageValidationError);
  assert.throws(
    () => create({ id: 'largo', body: 'a'.repeat(20_001) }),
    (error) => error.code === 'CHAT_MESSAGE_TOO_LONG'
  );
});

test('rechaza identificadores y tipos de contenido no admitidos', () => {
  assert.throws(() => create({ id: '../mensaje', body: 'hola' }), ChatMessageValidationError);
  assert.throws(
    () => create({ id: 'mensaje', body: 'hola', contentType: 'html' }),
    ChatMessageValidationError
  );
});

test('normaliza respuesta, menciones y reacciones a campos seguros', () => {
  const document = create({
    id: 'mensaje-2',
    body: 'Respuesta',
    replyTo: { id: 'anterior-1', body: 'Original', senderId: '84', secreto: 'no' },
    mentionIds: [84, '84', 0, 99],
    reactions: { 84: '👍', intruso: '❌', 99: '🎉' },
  });

  assert.deepEqual(document.respuestaA, {
    id: 'anterior-1',
    body: 'Original',
    senderId: '84',
  });
  assert.deepEqual(document.mencionesIds, [84, 99]);
  assert.deepEqual(document.reacciones, { 84: '👍', 99: '🎉' });
});

test('conserva solo metadatos funcionales conocidos', () => {
  const document = create({
    id: 'mensaje-3',
    body: 'Archivo compartido',
    metadata: {
      ordenId: 'orden-7',
      secreto: 'no debe persistir',
      sharedFile: {
        name: 'Acta.pdf',
        url: '/dashboard/file-manager/?folder=actas',
        message: 'Para revisión',
        token: 'privado',
      },
    },
  });

  assert.deepEqual(document.metadatos, {
    ordenId: 'orden-7',
    sharedFile: {
      name: 'Acta.pdf',
      url: '/dashboard/file-manager/?folder=actas',
      message: 'Para revisión',
    },
  });
});

test('acepta un documento seguro vinculado a la conversación', () => {
  const document = create({
    id: 'mensaje-archivo',
    body: 'manual.pdf',
    contentType: 'file',
    attachments: [validFile],
  });

  assert.equal(document.adjuntos.length, 1);
  assert.equal(document.adjuntos[0].storagePath, validFile.storagePath);
  assert.equal(document.adjuntos[0].almacenamiento, 'firebase');
  assert.equal(document.adjuntos[0].tipo, 'application/pdf');
});

test('rechaza adjuntos de otra conversación, URL insegura, MIME o tamaño inválido', () => {
  const baseMessage = {
    id: 'mensaje-archivo',
    body: 'manual.pdf',
    contentType: 'file',
  };

  assert.throws(
    () =>
      create({
        ...baseMessage,
        attachments: [{ ...validFile, storagePath: 'chat/otra/archivos/manual.pdf' }],
      }),
    (error) => error.code === 'CHAT_ATTACHMENT_PATH_INVALID'
  );
  assert.throws(
    () => create({ ...baseMessage, attachments: [{ ...validFile, url: 'javascript:alert(1)' }] }),
    (error) => error.code === 'CHAT_ATTACHMENT_URL_INVALID'
  );
  assert.throws(
    () => create({ ...baseMessage, attachments: [{ ...validFile, tipo: 'text/html' }] }),
    (error) => error.code === 'CHAT_ATTACHMENT_TYPE_INVALID'
  );
  assert.throws(
    () => create({ ...baseMessage, attachments: [{ ...validFile, tamano: 10 * 1024 * 1024 + 1 }] }),
    (error) => error.code === 'CHAT_ATTACHMENT_TYPE_INVALID'
  );
});

test('rechaza más de diez adjuntos y adjuntos declarados como texto', () => {
  assert.throws(
    () =>
      create({
        id: 'demasiados',
        body: 'archivos',
        contentType: 'file',
        attachments: Array.from({ length: 11 }, () => validFile),
      }),
    (error) => error.code === 'CHAT_ATTACHMENT_LIMIT_EXCEEDED'
  );
  assert.throws(
    () => create({ id: 'tipo-texto', body: 'archivo', attachments: [validFile] }),
    (error) => error.code === 'CHAT_ATTACHMENT_CONTENT_TYPE_INVALID'
  );
});

test('convierte mensajes históricos al contrato de UI sin romper compatibilidad', () => {
  const uiMessage = chatMessageToUi({
    idMensaje: 'historico-1',
    texto: 'Mensaje anterior',
    remitenteIdMiembros: 84,
    enviadoEn: now,
    vistoPorIdMiembros: { 42: true },
  });

  assert.equal(uiMessage.id, 'historico-1');
  assert.equal(uiMessage.versionModelo, 1);
  assert.equal(uiMessage.body, 'Mensaje anterior');
  assert.equal(uiMessage.senderId, '84');
  assert.deepEqual(uiMessage.seenByMemberIds, [42]);
});

test('valida el contenido de ediciones y reacciones antes de persistirlo', () => {
  assert.equal(normalizeChatMessageEditText('  texto corregido  '), 'texto corregido');
  assert.equal(normalizeChatReaction(' 👍 '), '👍');
  assert.throws(() => normalizeChatMessageEditText('   '), ChatMessageValidationError);
  assert.throws(() => normalizeChatReaction('me gusta'), ChatMessageValidationError);
  assert.equal(normalizeChatReaction('👨‍👩‍👧‍👦'), '👨‍👩‍👧‍👦');
  assert.throws(() => normalizeChatReaction('x'.repeat(17)), ChatMessageValidationError);
});

test('filtra reacciones históricas inválidas y limpia todas las de mensajes eliminados', () => {
  const historical = chatMessageToUi({
    idMensaje: 'historico-reacciones',
    texto: 'Anterior',
    remitenteIdMiembros: 84,
    reacciones: { 42: '👍🏽', 84: 'texto', 99: '👍👍' },
  });
  const deleted = chatMessageToUi({
    idMensaje: 'eliminado-reacciones',
    texto: 'Mensaje eliminado',
    remitenteIdMiembros: 84,
    eliminado: true,
    reacciones: { 42: '👍' },
  });

  assert.deepEqual(historical.reactions, { 42: '👍🏽' });
  assert.deepEqual(deleted.reactions, {});
});
