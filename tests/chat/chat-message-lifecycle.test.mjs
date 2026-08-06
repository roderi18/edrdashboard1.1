import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectChatAttachmentPaths,
  applyChatMessageLifecycleAction,
  CHAT_MESSAGE_RESTORE_WINDOW_MS,
} from '../../src/server/chat-message-lifecycle.mjs';

const sentAt = '2026-08-06T12:00:00.000Z';
const message = {
  idMensaje: 'mensaje-1',
  texto: 'Original',
  tipoContenido: 'file',
  adjuntos: [{ storagePath: 'chat/chat-1/archivos/documento.pdf' }],
  enviadoEn: sentAt,
  eliminado: false,
};

test('edita un mensaje activo sin destruir su contenido original', () => {
  const updated = applyChatMessageLifecycleAction({
    action: 'edit',
    message,
    text: 'Texto corregido',
    now: '2026-08-06T12:10:00.000Z',
  });

  assert.equal(updated.texto, 'Texto corregido');
  assert.equal(updated.editado, true);
  assert.equal(updated.tipoContenido, 'file');
});

test('elimina de forma reversible y oculta los adjuntos', () => {
  const deleted = applyChatMessageLifecycleAction({
    action: 'delete',
    message,
    now: '2026-08-06T12:30:00.000Z',
  });

  assert.equal(deleted.texto, 'Mensaje eliminado');
  assert.equal(deleted.eliminado, true);
  assert.deepEqual(deleted.adjuntos, []);
  assert.deepEqual(deleted.adjuntosOriginales, message.adjuntos);
});

test('rechaza eliminar fuera de la ventana de una hora', () => {
  assert.throws(
    () =>
      applyChatMessageLifecycleAction({
        action: 'delete',
        message,
        now: '2026-08-06T13:00:00.001Z',
      }),
    (error) => error.code === 'CHAT_MESSAGE_DELETE_WINDOW_EXPIRED'
  );
});

test('restaura dentro de cinco minutos y rechaza restauración tardía', () => {
  const deletedAt = '2026-08-06T12:30:00.000Z';
  const deleted = applyChatMessageLifecycleAction({ action: 'delete', message, now: deletedAt });
  const restored = applyChatMessageLifecycleAction({
    action: 'restore',
    message: deleted,
    now: new Date(new Date(deletedAt).getTime() + CHAT_MESSAGE_RESTORE_WINDOW_MS).toISOString(),
  });

  assert.equal(restored.texto, 'Original');
  assert.equal(restored.eliminado, false);
  assert.deepEqual(restored.adjuntos, message.adjuntos);
  assert.throws(
    () =>
      applyChatMessageLifecycleAction({
        action: 'restore',
        message: deleted,
        now: new Date(
          new Date(deletedAt).getTime() + CHAT_MESSAGE_RESTORE_WINDOW_MS + 1
        ).toISOString(),
      }),
    (error) => error.code === 'CHAT_MESSAGE_RESTORE_WINDOW_EXPIRED'
  );
});

test('deduplica únicamente rutas seguras de adjuntos para limpiar Storage', () => {
  assert.deepEqual(
    collectChatAttachmentPaths([
      message,
      { adjuntos: message.adjuntos },
      { adjuntos: [{ storagePath: '../secreto' }] },
    ]),
    ['chat/chat-1/archivos/documento.pdf']
  );
});
