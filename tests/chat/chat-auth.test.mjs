import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_AUTH_CODES,
  createCachedChatAuthenticator,
  createChatRequestAuthenticator,
  assertAuthenticatedConversationParticipant,
  bindAuthenticatedMessage,
  bindAuthenticatedConversation,
} from '../../src/server/chat-auth-core.mjs';


const requestWithAuthorization = (authorization) => ({
  headers: new Headers(authorization ? { Authorization: authorization } : {}),
});

const createAuthenticator = ({
  configured = true,
  decodedToken = { uid: 'firebase-uid-1', email: 'miembro@example.com' },
  profiles = [{ collection: 'usuarios_roles', id: 'firebase-uid-1', idMiembros: 42 }],
  verificationError = null,
} = {}) =>
  createChatRequestAuthenticator({
    isConfigured: () => configured,
    verifyIdToken: async () => {
      if (verificationError) throw verificationError;
      return decodedToken;
    },
    loadIdentityProfiles: async () => profiles,
  });

const expectAuthError = async (promise, { status, code }) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
};

test('rechaza el chat cuando Firebase Admin no está configurado', async () => {
  const authenticate = createAuthenticator({ configured: false });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token')), {
    status: 503,
    code: CHAT_AUTH_CODES.SERVER_NOT_CONFIGURED,
  });
});

test('rechaza solicitudes sin Bearer token', async () => {
  const authenticate = createAuthenticator();

  await expectAuthError(authenticate(requestWithAuthorization()), {
    status: 401,
    code: CHAT_AUTH_CODES.MISSING_TOKEN,
  });
});

test('rechaza encabezados de autorización mal formados', async () => {
  const authenticate = createAuthenticator();

  await expectAuthError(authenticate(requestWithAuthorization('Basic credenciales')), {
    status: 401,
    code: CHAT_AUTH_CODES.MISSING_TOKEN,
  });
});

test('rechaza tokens inválidos o expirados', async () => {
  const authenticate = createAuthenticator({ verificationError: new Error('expired') });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token-expirado')), {
    status: 401,
    code: CHAT_AUTH_CODES.INVALID_TOKEN,
  });
});

test('rechaza tokens verificados sin uid', async () => {
  const authenticate = createAuthenticator({ decodedToken: { email: 'sin-uid@example.com' } });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token')), {
    status: 401,
    code: CHAT_AUTH_CODES.INVALID_TOKEN,
  });
});

test('responde de forma controlada cuando falla la consulta del vínculo', async () => {
  const authenticate = createChatRequestAuthenticator({
    isConfigured: () => true,
    verifyIdToken: async () => ({ uid: 'firebase-uid-1' }),
    loadIdentityProfiles: async () => {
      throw new Error('Firestore no disponible');
    },
  });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token')), {
    status: 503,
    code: CHAT_AUTH_CODES.IDENTITY_LOOKUP_FAILED,
  });
});

test('rechaza usuarios autenticados sin vínculo con idMiembros', async () => {
  const authenticate = createAuthenticator({ profiles: [] });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token')), {
    status: 403,
    code: CHAT_AUTH_CODES.MEMBER_NOT_LINKED,
  });
});

test('rechaza un perfil de miembro inactivo', async () => {
  const authenticate = createAuthenticator({
    profiles: [
      {
        collection: 'usuarios_roles',
        id: 'firebase-uid-1',
        idMiembros: 42,
        estado: 'inactivo',
      },
    ],
  });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token')), {
    status: 403,
    code: CHAT_AUTH_CODES.MEMBER_INACTIVE,
  });
});

test('rechaza identidades con idMiembros contradictorios', async () => {
  const authenticate = createAuthenticator({
    decodedToken: { uid: 'firebase-uid-1', idMiembros: 42 },
    profiles: [{ collection: 'users', id: 'firebase-uid-1', idMiembros: 99 }],
  });

  await expectAuthError(authenticate(requestWithAuthorization('Bearer token')), {
    status: 403,
    code: CHAT_AUTH_CODES.MEMBER_ID_CONFLICT,
  });
});

test('deriva idMiembros del perfil vinculado al uid verificado', async () => {
  const authenticate = createAuthenticator();
  const actor = await authenticate(requestWithAuthorization('Bearer token-valido'));

  assert.equal(actor.uid, 'firebase-uid-1');
  assert.equal(actor.idMiembros, 42);
  assert.equal(actor.email, 'miembro@example.com');
  assert.equal(actor.token, 'token-valido');
});

test('acepta idMiembros firmado en el token cuando no existe un perfil duplicado', async () => {
  const authenticate = createAuthenticator({
    decodedToken: { uid: 'firebase-uid-1', idMiembros: '84' },
    profiles: [],
  });
  const actor = await authenticate(requestWithAuthorization('Bearer token-valido'));

  assert.equal(actor.idMiembros, 84);
});

test('reutiliza una identidad verificada y comparte solicitudes simultáneas', async () => {
  let calls = 0;
  let currentTime = 1_000;
  const authenticate = createCachedChatAuthenticator({
    authenticate: async () => {
      calls += 1;
      await Promise.resolve();
      return { uid: 'firebase-uid-1', idMiembros: 42 };
    },
    ttlMs: 30_000,
    now: () => currentTime,
  });
  const request = requestWithAuthorization('Bearer token-valido');

  const [first, second] = await Promise.all([authenticate(request), authenticate(request)]);
  const third = await authenticate(request);

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(second, third);

  currentTime += 30_001;
  await authenticate(request);
  assert.equal(calls, 2);
});

test('no conserva fallos de autenticación en caché', async () => {
  let calls = 0;
  const authenticate = createCachedChatAuthenticator({
    authenticate: async () => {
      calls += 1;
      if (calls === 1) throw new Error('fallo temporal');
      return { uid: 'firebase-uid-1', idMiembros: 42 };
    },
  });
  const request = requestWithAuthorization('Bearer token-valido');

  await assert.rejects(authenticate(request), /fallo temporal/);
  assert.equal((await authenticate(request)).idMiembros, 42);
  assert.equal(calls, 2);
});

test('el remitente siempre se reemplaza por el miembro autenticado', () => {
  assert.deepEqual(
    bindAuthenticatedMessage(
      { senderId: 999, remitenteIdMiembros: 999, texto: 'Hola' },
      { idMiembros: 42 }
    ),
    { senderId: 42, remitenteIdMiembros: 42, texto: 'Hola' }
  );
});

test('el creador y primer mensaje siempre se vinculan al miembro autenticado', () => {
  const result = bindAuthenticatedConversation(
    {
      creadoPorIdMiembros: 999,
      messages: [{ senderId: 999, remitenteIdMiembros: 999, body: 'Inicio' }],
    },
    { idMiembros: 42 }
  );

  assert.equal(result.creadoPorIdMiembros, 42);
  assert.equal(result.messages[0].senderId, 42);
  assert.equal(result.messages[0].remitenteIdMiembros, 42);
});

test('una conversación nueva debe incluir al miembro autenticado', () => {
  assert.throws(
    () => assertAuthenticatedConversationParticipant([7, 8], { idMiembros: 42 }),
    (error) => {
      assert.equal(error.status, 403);
      assert.equal(error.code, CHAT_AUTH_CODES.MEMBER_NOT_PARTICIPANT);
      return true;
    }
  );

  assert.equal(
    assertAuthenticatedConversationParticipant([7, 42], { idMiembros: 42 }),
    42
  );
});
