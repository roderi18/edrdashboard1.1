import assert from 'node:assert/strict';
import test from 'node:test';

import {
  startChatOperation,
  toSafeChatErrorMetric,
} from '../../src/server/chat-observability.mjs';

test('las métricas conservan código y estado sin filtrar mensajes sensibles', () => {
  const metric = toSafeChatErrorMetric({
    code: 'PERMISSION_DENIED',
    status: 403,
    message: 'token secreto correo@example.com mensaje privado',
  });

  assert.deepEqual(metric, {
    code: 'PERMISSION_DENIED',
    status: 403,
    category: 'authorization',
  });
  assert.doesNotMatch(JSON.stringify(metric), /secreto|example|privado/);
});

test('registra duración, endpoint e identificador sin parámetros del usuario', () => {
  let time = 10;
  let entry = null;
  const operation = startChatOperation({
    method: 'GET',
    url: 'https://app.local/api/chat?endpoint=conversation&conversationId=secreto',
    requestId: 'request-1',
    now: () => time,
    write: (value) => {
      entry = value;
    },
  });

  time = 22.5;
  operation.finish();

  assert.equal(entry.durationMs, 12.5);
  assert.equal(entry.endpoint, 'conversation');
  assert.equal(entry.requestId, 'request-1');
  assert.doesNotMatch(JSON.stringify(entry), /conversationId|secreto/);
});
