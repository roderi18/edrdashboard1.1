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
    /addMessage\(\s*body\.conversationId,\s*body\.messageData,\s*chatActor\.idMiembros\s*\)/
  );
  assert.match(routeSource, /viewerIdMiembros:\s*chatActor\.idMiembros/g);
});
