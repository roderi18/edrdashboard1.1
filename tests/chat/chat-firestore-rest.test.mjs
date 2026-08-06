import assert from 'node:assert/strict';
import test from 'node:test';

import {
  jsToFirestoreValue,
  firestoreValueToJs,
  createChatFirestoreRestClient,
} from '../../src/server/chat-firestore-rest.mjs';

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const firestoreDocument = (path, fields = {}) => ({
  name: `projects/demo/databases/(default)/documents/${path}`,
  fields,
});

test('convierte valores Firestore REST sin perder mapas, listas ni enteros', () => {
  const source = {
    idMiembros: 42,
    activo: true,
    tags: ['chat', 'seguro'],
    alcance: { region: 4 },
  };
  const encoded = jsToFirestoreValue(source);

  assert.deepEqual(firestoreValueToJs(encoded), source);
});

test('todas las operaciones REST propagan el token del usuario', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (init.method === 'POST') {
      return jsonResponse([
        {
          document: firestoreDocument('conversaciones_chat/chat-1', {
            participantesIds: { arrayValue: { values: [{ integerValue: '42' }] } },
          }),
        },
      ]);
    }

    return jsonResponse(
      firestoreDocument('conversaciones_chat/chat-1', {
        participantesIds: { arrayValue: { values: [{ integerValue: '42' }] } },
      })
    );
  };
  const client = createChatFirestoreRestClient({
    projectId: 'demo',
    token: 'token-firebase',
    fetchImpl,
  });

  await client.getDocument('conversaciones_chat/chat-1');
  await client.setDocument('conversaciones_chat/chat-1', { actualizadoEn: 'ahora' }, { merge: true });
  const results = await client.runQuery({
    collectionId: 'conversaciones_chat',
    filters: [
      { field: 'eliminada', op: '==', value: false },
      { field: 'participantesIds', op: 'array-contains', value: 42 },
    ],
  });

  assert.equal(results[0].participantesIds[0], 42);
  assert.ok(
    calls.every((call) => call.init.headers.Authorization === 'Bearer token-firebase')
  );
  assert.match(calls[1].url, /updateMask\.fieldPaths=actualizadoEn/);

  const queryBody = JSON.parse(calls[2].init.body);
  assert.equal(queryBody.structuredQuery.where.compositeFilter.filters.length, 2);
  assert.equal(
    queryBody.structuredQuery.where.compositeFilter.filters[1].fieldFilter.op,
    'ARRAY_CONTAINS'
  );
});

test('una denegación de reglas se conserva como error 403 de Firestore', async () => {
  const client = createChatFirestoreRestClient({
    projectId: 'demo',
    token: 'token-firebase',
    fetchImpl: async () =>
      jsonResponse({ error: { status: 'PERMISSION_DENIED', message: 'Missing permissions' } }, 403),
  });

  await assert.rejects(client.getDocument('conversaciones_chat/chat-ajeno'), (error) => {
    assert.equal(error.status, 403);
    assert.equal(error.code, 'PERMISSION_DENIED');
    return true;
  });
});

test('confirma cambios relacionados en una sola operación atómica', async () => {
  let request = null;
  const client = createChatFirestoreRestClient({
    projectId: 'demo',
    token: 'token-firebase',
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return jsonResponse({ writeResults: [{ updateTime: '2026-08-06T12:00:00Z' }] });
    },
  });

  await client.commitWrites([
    {
      type: 'set',
      path: 'conversaciones_chat/chat-1/mensajes/msg-1',
      data: { texto: 'Editado' },
      merge: true,
    },
    {
      type: 'set',
      path: 'conversaciones_chat/chat-1/auditoria/evento-1',
      data: { accion: 'mensaje_editado' },
    },
  ]);

  assert.match(request.url, /documents:commit$/);
  assert.equal(request.init.headers.Authorization, 'Bearer token-firebase');
  const body = JSON.parse(request.init.body);
  assert.equal(body.writes.length, 2);
  assert.deepEqual(body.writes[0].updateMask.fieldPaths, ['texto']);
  assert.match(body.writes[1].update.name, /auditoria\/evento-1$/);
});

test('permite actualizar un campo anidado sin sobrescribir el mapa completo', async () => {
  let requestedUrl = '';
  const client = createChatFirestoreRestClient({
    projectId: 'demo',
    token: 'token-firebase',
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse(firestoreDocument('conversaciones_chat/chat-1'));
    },
  });

  await client.setDocument(
    'conversaciones_chat/chat-1',
    { escribiendoPorIdMiembros: { 42: '2026-08-06T12:00:00.000Z' } },
    { merge: true, fieldPaths: ['escribiendoPorIdMiembros.`42`'] }
  );

  assert.match(requestedUrl, /updateMask\.fieldPaths=escribiendoPorIdMiembros/);
  assert.match(decodeURIComponent(requestedUrl), /escribiendoPorIdMiembros\.`42`/);
});
