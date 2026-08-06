import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';

import { createCachedChatAuthenticator } from '../../src/server/chat-auth-core.mjs';
import { buildConversationPage } from '../../src/server/chat-pagination.mjs';
import { chunkPresenceIds } from '../../src/sections/chat/utils/presence-state.mjs';
import { mergeRealtimeMessageChanges } from '../../src/sections/chat/utils/realtime-sync.mjs';

const makeToken = () => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 600 })}.sig`;
};

test('large realtime message sets merge without duplicates or data loss', () => {
  const messages = Array.from({ length: 10_000 }, (_, index) => ({
    id: `m-${index}`,
    body: `Mensaje ${index}`,
    createdAt: new Date(1_700_000_000_000 + index).toISOString(),
  }));
  const changes = Array.from({ length: 1_000 }, (_, index) => ({
    type: 'modified',
    id: `m-${index * 5}`,
    data: {
      idMensaje: `m-${index * 5}`,
      texto: `Actualizado ${index}`,
      enviadoEn: messages[index * 5].createdAt,
    },
  }));

  const startedAt = performance.now();
  const merged = mergeRealtimeMessageChanges({ messages, changes });
  const durationMs = performance.now() - startedAt;

  assert.equal(merged.length, 10_000);
  assert.equal(new Set(merged.map((message) => message.id)).size, 10_000);
  assert.equal(merged.find((message) => message.id === 'm-25').body, 'Actualizado 5');
  assert.ok(durationMs < 2_000, `La mezcla tardó ${durationMs.toFixed(2)} ms`);
});

test('concurrent authenticated requests share the in-flight authentication result', async () => {
  let authenticationReads = 0;
  const authenticate = async () => {
    authenticationReads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { idMiembros: 42 };
  };
  const cachedAuthenticate = createCachedChatAuthenticator({ authenticate, ttlMs: 60_000 });
  const token = makeToken();
  const request = { headers: { get: () => `Bearer ${token}` } };

  const actors = await Promise.all(
    Array.from({ length: 250 }, () => cachedAuthenticate(request))
  );

  assert.equal(authenticationReads, 1);
  assert.equal(actors.length, 250);
  assert.ok(actors.every((actor) => actor.idMiembros === 42));
});

test('pagination and presence batching stay bounded for large directories', () => {
  const conversations = Array.from({ length: 10_000 }, (_, index) => ({
    idConversacion: `c-${index}`,
    actualizadoEn: new Date(1_700_000_000_000 - index).toISOString(),
  }));
  const page = buildConversationPage({ conversations, pageSize: 30 });
  const listenerBatches = chunkPresenceIds(
    Array.from({ length: 500 }, (_, index) => String(index + 1))
  );

  assert.equal(page.conversations.length, 30);
  assert.equal(page.hasMore, true);
  assert.ok(page.nextCursor);
  assert.deepEqual(listenerBatches.map((batch) => batch.length), [
    ...Array(16).fill(30),
    20,
  ]);
});
