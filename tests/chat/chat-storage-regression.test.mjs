import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storageRules = await readFile(new URL('../../storage.rules', import.meta.url), 'utf8');
const inputSource = await readFile(
  new URL('../../src/sections/chat/chat-message-input.jsx', import.meta.url),
  'utf8'
);
const uploadSource = await readFile(
  new URL('../../src/utils/firebase-file-storage.js', import.meta.url),
  'utf8'
);

test('Storage restringe archivos del chat a participantes de la conversación', () => {
  assert.match(storageRules, /function esParticipanteChat\(idConversacion\)/);
  assert.match(storageRules, /firestore\.get\(rutaConversacionChat\(idConversacion\)\)/);
  assert.match(storageRules, /match \/chat\/\{idConversacion\}\/imagenes\/\{archivo\}/);
  assert.match(storageRules, /match \/chat\/\{idConversacion\}\/archivos\/\{archivo\}/);
  assert.match(storageRules, /resource == null/g);
  assert.match(storageRules, /allow update: if false/g);
});

test('las cargas usan la conversación real y metadatos ligados al usuario autenticado', () => {
  assert.match(inputSource, /createConversation\(\s*\{ \.\.\.conversationData, messages: \[\] \}/);
  assert.match(inputSource, /chat\/\$\{activeConversationId\}\/imagenes/);
  assert.match(inputSource, /chat\/\$\{activeConversationId\}\/archivos/);
  assert.match(inputSource, /idConversacion: String\(activeConversationId\)/g);
  assert.doesNotMatch(inputSource, /idMiembros \|\| ['"]nuevo['"]/);
  assert.match(uploadSource, /AUTH\?\.currentUser\?\.uid/);
  assert.match(uploadSource, /uploaderUid/);
});
