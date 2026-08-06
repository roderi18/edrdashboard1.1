import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getChatMemberDirectory,
  getMemberRowsFromDirectoryPayload,
  resolveDirectoryIdentityProfiles,
} from '../../src/server/chat-identity-directory.mjs';
import { CHAT_AUTH_CODES, resolveAuthenticatedMember } from '../../src/server/chat-auth-core.mjs';

const members = [
  {
    idMiembros: 42,
    codigoMiembro: 'DO-SD-111111038',
    correo: 'oliver@example.com',
    nombres: 'Oliver',
    apellidos: 'Feliz',
    estatusMiembro: 'activo',
  },
  {
    idMiembros: 84,
    codigoMiembro: 'DO-SD-111111099',
    correo: 'alanna@example.com',
    nombres: 'Alanna',
    estatusMiembro: 'activo',
  },
];

test('vincula el correo autenticado sintético con el código del directorio', () => {
  const profiles = resolveDirectoryIdentityProfiles({
    decodedToken: { email: 'do-sd-111111038@exploradores.app' },
    members,
  });

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].idMiembros, 42);
  assert.equal(resolveAuthenticatedMember({ profiles }).idMiembros, 42);
});

test('vincula perfiles verificados por uid que todavía solo tienen código de miembro', () => {
  const profiles = resolveDirectoryIdentityProfiles({
    decodedToken: { email: 'cuenta@example.com' },
    profiles: [{ id: 'uid-1', codigoMiembro: 'DO-SD-111111099' }],
    members,
  });

  assert.deepEqual(
    profiles.map((profile) => profile.idMiembros),
    [84]
  );
});

test('vincula por correo real verificado y no acepta identidades sin coincidencia', () => {
  assert.equal(
    resolveDirectoryIdentityProfiles({
      decodedToken: { email: 'oliver@example.com' },
      members,
    })[0].idMiembros,
    42
  );
  assert.deepEqual(
    resolveDirectoryIdentityProfiles({
      decodedToken: { email: 'intruso@example.com' },
      members,
    }),
    []
  );
});

test('mantiene el rechazo de miembros inactivos resueltos desde el directorio', () => {
  const profiles = resolveDirectoryIdentityProfiles({
    decodedToken: { email: 'do-sd-111111038@exploradores.app' },
    members: [{ ...members[0], estatusMiembro: 'inactivo' }],
  });

  assert.throws(
    () => resolveAuthenticatedMember({ profiles }),
    (error) => error.code === CHAT_AUTH_CODES.MEMBER_INACTIVE
  );
});

test('extrae listas de las variantes conocidas del proveedor', () => {
  assert.deepEqual(getMemberRowsFromDirectoryPayload({ Data: members }), members);
  assert.deepEqual(getMemberRowsFromDirectoryPayload({ data: members }), members);
  assert.deepEqual(getMemberRowsFromDirectoryPayload(members), members);
});

test('carga el directorio con límite temporal y valida la respuesta HTTP', async () => {
  let requestInit = null;
  const result = await getChatMemberDirectory({
    useCache: false,
    fetchImpl: async (_url, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ data: members }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.deepEqual(result, members);
  assert.equal(requestInit.cache, 'no-store');
  assert.ok(requestInit.signal instanceof AbortSignal);

  await assert.rejects(
    getChatMemberDirectory({
      useCache: false,
      fetchImpl: async () => new Response('{}', { status: 503 }),
    }),
    /HTTP 503/
  );
});
