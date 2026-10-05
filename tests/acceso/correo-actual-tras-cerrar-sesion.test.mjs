import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { resolverCorreosDeMiembroPorNumero } =
  await import('../../src/utils/member-sign-in.js');
const { resolveAdminSignInEmail } =
  await import('../../src/utils/admin-profile.js');

test('el acceso de miembro consulta el correo actual aunque haya uno antiguo en el navegador', async (t) => {
  const anterior = globalThis.fetch;
  const navegador = globalThis.window;
  const consultas = [];
  globalThis.window = {
    localStorage: {
      getItem: () => 'correo-antiguo@example.org',
      setItem: () => assert.fail('no debe guardar el correo de acceso'),
    },
  };
  globalThis.fetch = async (url, options) => {
    consultas.push({ url, body: JSON.parse(options.body) });
    return { json: async () => ({ correo: 'oficinanacional@errd.org.do' }) };
  };
  t.after(() => { globalThis.fetch = anterior; globalThis.window = navegador; });

  assert.deepEqual(await resolverCorreosDeMiembroPorNumero('10049'), [
    'oficinanacional@errd.org.do',
  ]);
  assert.deepEqual(consultas, [
    { url: '/api/auth/correo-acceso/', body: { numeroUsuario: '10049' } },
  ]);
});

test('el acceso administrativo resuelve de nuevo el código tras cerrar sesión', async (t) => {
  const anterior = globalThis.fetch;
  const navegador = globalThis.window;
  let usuarioConsultado = '';
  globalThis.window = {
    localStorage: {
      getItem: () => 'correo-antiguo@example.org',
      setItem: () => assert.fail('no debe guardar el correo de acceso'),
    },
  };
  globalThis.fetch = async (_url, options) => {
    usuarioConsultado = JSON.parse(options.body).usuario;
    return { ok: true, json: async () => ({ correo: 'oficinanacional@errd.org.do' }) };
  };
  t.after(() => { globalThis.fetch = anterior; globalThis.window = navegador; });

  assert.equal(await resolveAdminSignInEmail('EDR-10049'), 'oficinanacional@errd.org.do');
  assert.equal(usuarioConsultado, 'edr-10049');
});
