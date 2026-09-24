// ----------------------------------------------------------------------
// LO QUE NO CAMBIÓ NO VUELVE A VIAJAR (ETag en /api).
//
// Qué se rompía: el padrón y las listas de la organización viajaban enteros en
// cada petición. Con la huella, una segunda petición igual recibe un 304 vacío;
// y como el padrón va acotado por cuenta, nunca se comparte en cachés ajenas.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { responderConEtag } = await import('src/utils/respuesta-con-etag.mjs');

const pedir = (etag) => new Request('http://x/api/members/', etag ? { headers: { 'If-None-Match': etag } } : {});

test('la primera vez viaja el cuerpo con su huella, privada', async () => {
  const respuesta = responderConEtag(pedir(), { data: [1, 2] });

  assert.equal(respuesta.status, 200);
  assert.ok(respuesta.headers.get('etag'));
  assert.match(respuesta.headers.get('cache-control'), /private/);
  assert.equal(respuesta.headers.get('vary'), 'Authorization');
  assert.deepEqual(await respuesta.json(), { data: [1, 2] });
});

test('si no cambió, 304 vacío', async () => {
  const etag = responderConEtag(pedir(), { data: [1, 2] }).headers.get('etag');
  const respuesta = responderConEtag(pedir(etag), { data: [1, 2] });

  assert.equal(respuesta.status, 304);
  assert.equal(await respuesta.text(), '');
});

test('si cambió, viaja otra vez', () => {
  const etag = responderConEtag(pedir(), { data: [1] }).headers.get('etag');

  assert.equal(responderConEtag(pedir(etag), { data: [1, 2] }).status, 200);
});
