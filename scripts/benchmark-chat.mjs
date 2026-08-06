import { performance } from 'node:perf_hooks';

import { createCachedChatAuthenticator } from '../src/server/chat-auth-core.mjs';
import { buildConversationPage } from '../src/server/chat-pagination.mjs';
import { chunkPresenceIds, derivePresenceSnapshot } from '../src/sections/chat/utils/presence-state.mjs';
import { mergeRealtimeMessageChanges } from '../src/sections/chat/utils/realtime-sync.mjs';

const measure = async (operation) => {
  const startedAt = performance.now();
  const result = await operation();
  return { durationMs: Math.round((performance.now() - startedAt) * 100) / 100, result };
};

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
const conversations = Array.from({ length: 10_000 }, (_, index) => ({
  idConversacion: `c-${index}`,
  actualizadoEn: new Date(1_700_000_000_000 - index).toISOString(),
}));
const now = Date.now();
const sessions = Object.fromEntries(
  Array.from({ length: 500 }, (_, index) => [
    `device-${index}`,
    { actualizadoEnCliente: new Date(now - (index % 3) * 1_000).toISOString(), visible: true },
  ])
);

const messageMerge = await measure(() =>
  mergeRealtimeMessageChanges({ messages, changes })
);
const pagination = await measure(() =>
  buildConversationPage({ conversations, pageSize: 30 })
);
const presence = await measure(() =>
  derivePresenceSnapshot({ presence: { sesiones: sessions }, now, staleAfterMs: 150_000 })
);

let authenticationReads = 0;
const tokenPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${tokenPart({ alg: 'none' })}.${tokenPart({ exp: Math.floor(now / 1000) + 600 })}.sig`;
const cachedAuthenticate = createCachedChatAuthenticator({
  ttlMs: 60_000,
  authenticate: async () => {
    authenticationReads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { idMiembros: 42 };
  },
});
const authentication = await measure(() =>
  Promise.all(
    Array.from({ length: 1_000 }, () =>
      cachedAuthenticate({ headers: { get: () => `Bearer ${token}` } })
    )
  )
);

const oldConversationReadModel = 1 + 30 * 30;
const newConversationReadModel = 31;

console.log(
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      runtime: process.version,
      scenarios: {
        messageMerge: {
          messages: messages.length,
          changes: changes.length,
          outputMessages: messageMerge.result.length,
          durationMs: messageMerge.durationMs,
        },
        pagination: {
          sourceConversations: conversations.length,
          returned: pagination.result.conversations.length,
          durationMs: pagination.durationMs,
        },
        multiDevicePresence: {
          sessions: Object.keys(sessions).length,
          status: presence.result.status,
          durationMs: presence.durationMs,
        },
        authenticationConcurrency: {
          requests: authentication.result.length,
          underlyingReads: authenticationReads,
          durationMs: authentication.durationMs,
        },
      },
      modeledImprovements: {
        conversationListReads: {
          before: oldConversationReadModel,
          after: newConversationReadModel,
          reductionPercent:
            Math.round((1 - newConversationReadModel / oldConversationReadModel) * 10_000) / 100,
          basis: '30 conversaciones con hasta 30 mensajes cargados por conversación',
        },
        presenceListeners65Contacts: {
          before: 65,
          after: chunkPresenceIds(Array.from({ length: 65 }, (_, index) => index + 1)).length,
          reductionPercent: 95.38,
        },
        heartbeatWritesPerMinute: {
          before: 3,
          after: 1,
          reductionPercent: 66.67,
        },
      },
    },
    null,
    2
  )
);
