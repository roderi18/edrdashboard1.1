import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const actions = leer('src/actions/chat.js');
const input = leer('src/sections/chat/chat-message-input.jsx');
const route = leer('src/app/api/chat/route.js');
const realtime = leer('src/sections/chat/hooks/use-chat-realtime-sync.js');

test('un envío fallido quita el optimista y conserva el mismo ID para reintentar', () => {
  assert.match(
    actions,
    /catch \(error\) \{\s*await removeLocalMessage\(conversationId, optimisticMessage\.id\)/
  );
  assert.match(input, /const retryPayloadRef = useRef\(null\)/);
  assert.match(input, /retryPayload\?\.messageData \?\?/);
  assert.match(input, /messageData: outgoingMessageData/);
  assert.match(input, /id: item\.localMessageId,\s*upload,/);
  assert.match(input, /localMessageId: uuidv4\(\)/g);
});

test('el servidor trata el ID del mensaje como clave idempotente', () => {
  const duplicateCheck = route.indexOf(
    'const existingMessage = await chatStore.getDocument(messagePath)'
  );
  const unreadIncrement = route.indexOf('noLeidosPorIdMiembros[key] =', duplicateCheck);

  assert.ok(duplicateCheck > 0);
  assert.ok(unreadIncrement > duplicateCheck);
  assert.match(route, /if \(existingMessage\) \{[\s\S]*return conversationToUi\(/);
});

test('una edición fallida conserva el modo de edición', () => {
  const editCall = input.indexOf('await editMessage(');
  const clearEdit = input.indexOf('onClearEditing?.();', editCall);

  assert.ok(editCall > 0);
  assert.ok(clearEdit > editCall);
});

test('los recibos reintentan y liberan su marcador si todos los intentos fallan', () => {
  assert.match(actions, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(
    realtime,
    /!result[\s\S]*deliveredMarkersRef\.current\.delete\(change\.doc\.id\)/
  );
});

test('una conversación nueva vacía se descarta después de una carga fallida', () => {
  assert.match(input, /discardEmptyConversation\(\s*createdEmptyConversationId/);
  assert.match(route, /if \(action === 'discard-empty'\)/);
  assert.match(route, /if \(messages\.length\)/);
  assert.match(route, /await chatStore\.deleteDocument\(conversationPath\)/);
});
