import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_QUOTA_MESSAGE,
  getChatErrorMessage,
  isChatQuotaError,
  logChatClientError,
} from '../../src/utils/chat-error.mjs';

test('chat quota errors share the explorer-friendly message', () => {
  const error = Object.assign(new Error('Quota exceeded.'), { code: 'RESOURCE_EXHAUSTED' });

  assert.equal(isChatQuotaError(error), true);
  assert.equal(getChatErrorMessage(error), CHAT_QUOTA_MESSAGE);
});

test('client error telemetry excludes raw messages and sensitive values', () => {
  const originalWarn = console.warn;
  let emitted = '';
  console.warn = (value) => {
    emitted = value;
  };

  try {
    const entry = logChatClientError(
      'send-message',
      Object.assign(new Error('Bearer secret-token user@example.com'), {
        code: 'BAD/REQUEST',
        status: 500,
        requestId: 'req-123',
      })
    );

    assert.deepEqual(entry, {
      event: 'chat_client_error',
      scope: 'send-message',
      code: 'BADREQUEST',
      status: 500,
      requestId: 'req-123',
    });
    assert.doesNotMatch(emitted, /secret-token|example\.com|Bearer/);
  } finally {
    console.warn = originalWarn;
  }
});
