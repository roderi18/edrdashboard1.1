import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';


const routeUrl = new URL('../../src/app/api/chat/route.js', import.meta.url);
const routeSource = await readFile(routeUrl, 'utf8');

test('los cuatro métodos autentican la solicitud', () => {
  const calls = routeSource.match(/authenticateChatRequest\(req\)/g) ?? [];

  assert.equal(calls.length, 4);
});

test('la ruta no deriva la identidad desde query idMiembros', () => {
  assert.doesNotMatch(routeSource, /searchParams\.get\(['"]idMiembros['"]\)/);
});

test('la ruta no deriva la identidad desde body.idMiembros', () => {
  assert.doesNotMatch(routeSource, /body\.idMiembros/);
});

test('envío, creación y mutaciones usan la identidad autenticada', () => {
  assert.match(
    routeSource,
    /createConversation\(body\.conversationData,\s*chatActor\)/
  );
  assert.match(
    routeSource,
    /addMessage\(\s*body\.conversationId,\s*body\.messageData,\s*chatActor\s*\)/
  );
  assert.match(routeSource, /chatActor,/g);
});

test('las operaciones sensibles usan la autorización centralizada del servidor', () => {
  assert.match(routeSource, /assertChatPermission\(chatActor, CHAT_PERMISSIONS\.VIEW\)/);
  assert.match(routeSource, /assertConversationParticipant\(conversation, chatActor\)/g);
  assert.match(routeSource, /authorizeConversationOperation\(\{/g);
  assert.match(routeSource, /assertMessageAuthor\(messageData, chatActor\)/);
  assert.match(routeSource, /chatAuthorizationErrorResponse\(error\)/g);
});

test('contactos y participantes se proyectan al contrato público del chat', () => {
  assert.match(routeSource, /getPublicChatContacts\(/);
  assert.match(routeSource, /toPublicChatContact\(/g);
  assert.match(
    routeSource,
    /remitente:\s*toPublicChatContact\(\{/
  );
  assert.match(routeSource, /['"]Cache-Control['"]:\s*['"]private, no-store['"]/);
});

test('la vista espera el token y el sidebar usa el resumen global de no leidos', async () => {
  const chatViewSource = await readFile(
    new URL('../../src/sections/chat/view/chat-view.jsx', import.meta.url),
    'utf8'
  );
  const dashboardLayoutSource = await readFile(
    new URL('../../src/layouts/dashboard/layout.jsx', import.meta.url),
    'utf8'
  );

  assert.match(chatViewSource, /useGetContacts\(Boolean\(user\?\.accessToken\)\)/);
  assert.match(
    dashboardLayoutSource,
    /useGetChatUnreadSummary\(chatMemberId, chatSummaryEnabled\)/
  );
  assert.match(dashboardLayoutSource, /useChatRealtimeSync\(\{/);
  assert.match(dashboardLayoutSource, /usePresenceHeartbeat\(/);
  assert.doesNotMatch(dashboardLayoutSource, /useGetConversations/);
});

test('el resumen de no leidos no descarga mensajes de las conversaciones', () => {
  const start = routeSource.indexOf('async function getUnreadSummary');
  const end = routeSource.indexOf('async function createConversation', start);
  const summarySource = routeSource.slice(start, end);

  assert.ok(start >= 0);
  assert.match(routeSource, /endpoint === ['"]unread-summary['"]/);
  assert.match(summarySource, /noLeidosPorIdMiembros/);
  assert.doesNotMatch(summarySource, /getMessages\(/);
});
