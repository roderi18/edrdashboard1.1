import assert from 'node:assert/strict';
import test from 'node:test';

import {
  firestoreDocumentToProfile,
  isFirebaseRestAuthConfigured,
  createFirebaseRestIdentityProvider,
} from '../../src/server/firebase-auth-rest.mjs';

const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('detecta la configuracion publica necesaria para validar tokens', () => {
  assert.equal(
    isFirebaseRestAuthConfigured({
      NEXT_PUBLIC_FIREBASE_API_KEY: 'api-key',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'project-id',
    }),
    true
  );
  assert.equal(isFirebaseRestAuthConfigured({ NEXT_PUBLIC_FIREBASE_API_KEY: 'api-key' }), false);
});

test('convierte documentos Firestore REST incluyendo mapas y arreglos', () => {
  const profile = firestoreDocumentToProfile(
    {
      name: 'projects/demo/databases/(default)/documents/usuarios_roles/firebase-uid-1',
      fields: {
        idMiembros: { integerValue: '257' },
        estado: { stringValue: 'activo' },
        alcance: {
          mapValue: {
            fields: {
              regiones: {
                arrayValue: { values: [{ integerValue: '4' }, { integerValue: '7' }] },
              },
            },
          },
        },
      },
    },
    'usuarios_roles'
  );

  assert.deepEqual(profile, {
    collection: 'usuarios_roles',
    id: 'firebase-uid-1',
    idMiembros: 257,
    estado: 'activo',
    alcance: { regiones: [4, 7] },
  });
});

test('valida el ID token y obtiene el perfil propio sin service account', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url).includes('identitytoolkit.googleapis.com')) {
      return jsonResponse({
        users: [
          {
            localId: 'firebase-uid-1',
            email: 'alanna@example.com',
            customAttributes: '{"rol":"miembro"}',
          },
        ],
      });
    }

    if (String(url).endsWith('/usuarios_roles/firebase-uid-1')) {
      return jsonResponse({
        name: 'projects/demo/databases/(default)/documents/usuarios_roles/firebase-uid-1',
        fields: {
          idMiembros: { integerValue: '257' },
          estado: { stringValue: 'activo' },
        },
      });
    }

    return jsonResponse({ error: { message: 'Not found' } }, 404);
  };
  const provider = createFirebaseRestIdentityProvider({
    apiKey: 'api-key',
    projectId: 'demo',
    fetchImpl,
  });

  const decodedToken = await provider.verifyIdToken('token-valido');
  const profiles = await provider.loadIdentityProfiles({
    uid: decodedToken.uid,
    email: decodedToken.email,
    token: 'token-valido',
  });

  assert.deepEqual(decodedToken, {
    rol: 'miembro',
    uid: 'firebase-uid-1',
    email: 'alanna@example.com',
  });
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].idMiembros, 257);
  assert.equal(
    calls.filter((call) => call.url.includes('firestore.googleapis.com')).length,
    3
  );
  assert.ok(
    calls
      .filter((call) => call.url.includes('firestore.googleapis.com'))
      .every((call) => call.init.headers.Authorization === 'Bearer token-valido')
  );
});

test('rechaza un token que Firebase no reconoce', async () => {
  const provider = createFirebaseRestIdentityProvider({
    apiKey: 'api-key',
    projectId: 'demo',
    fetchImpl: async () => jsonResponse({ error: { message: 'INVALID_ID_TOKEN' } }, 400),
  });

  await assert.rejects(provider.verifyIdToken('token-invalido'), /INVALID_ID_TOKEN/);
});
