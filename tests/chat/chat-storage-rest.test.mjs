import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteChatStorageObjects } from '../../src/server/chat-storage-rest.mjs';

test('elimina adjuntos seguros con el token del usuario y reporta fallos', async () => {
  const calls = [];
  const result = await deleteChatStorageObjects({
    bucket: 'demo.appspot.com',
    token: 'token-firebase',
    paths: [
      'chat/chat-1/archivos/documento.pdf',
      'chat/chat-1/imagenes/foto.webp',
      '../ruta-insegura',
    ],
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: String(url).includes('foto') ? 403 : 204 });
    },
  });

  assert.deepEqual(result.deleted, ['chat/chat-1/archivos/documento.pdf']);
  assert.equal(result.failed[0].path, 'chat/chat-1/imagenes/foto.webp');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.init.headers.Authorization === 'Bearer token-firebase'));
});
