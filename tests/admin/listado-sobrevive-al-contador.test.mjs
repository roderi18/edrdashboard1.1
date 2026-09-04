import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL CONTADOR NO PUEDE TUMBAR LA LISTA.
//
// /api/sectional pide dos cosas al upstream: las SECCIONES, que son la
// respuesta, y las IGLESIAS, que solo sirven para contar cuantas cuelgan de
// cada seccion. Iban juntas en un `Promise.all`, asi que unas iglesias lentas
// —el upstream libre va de 0.3s a mas de 17s— devolvian un 500 y en la pantalla
// de asistencia salia "Error al obtener seccionales: El servidor de datos no
// respondió en 9s.", aunque las secciones hubieran llegado enteras.
//
// /api/regional tiene el mismo reparto: regiones arriba, secciones de contador.

const { invalidateUpstream } = await import('src/utils/upstream-cache.js');
const { GET: getSecciones } = await import('src/app/api/sectional/route.js');
const { GET: getRegiones } = await import('src/app/api/regional/route.js');

const SECCIONES = JSON.stringify({
  data: [{ idSeccion: 7, nombre: 'Seccion Norte', idRegion: 3 }],
});

const REGIONES = JSON.stringify({ data: [{ idRegion: 3, nombre: 'Region Centro' }] });

// El corte de los 9 segundos llega aqui como un Error, igual que un upstream
// caido: la prueba no espera de verdad, reproduce el rechazo.
const SE_AGOTO = () => Promise.reject(new Error('El servidor de datos no respondió en 9s.'));

const respuesta = (texto) => ({ ok: true, status: 200, text: async () => texto });

const conFetch = async (impl, ejecutar) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;

  try {
    return await ejecutar();
  } finally {
    globalThis.fetch = original;
  }
};

test.beforeEach(() => {
  invalidateUpstream();
});

test('las secciones se devuelven aunque las iglesias no lleguen', async () => {
  const res = await conFetch(
    (url) => (String(url).includes('GetAllIglesias') ? SE_AGOTO() : respuesta(SECCIONES)),
    () => getSecciones()
  );

  assert.equal(res.status, 200);

  const cuerpo = await res.json();
  const secciones = cuerpo?.data ?? cuerpo?.Data ?? [];

  assert.equal(secciones.length, 1);
  assert.equal(secciones[0].nombre, 'Seccion Norte');
  // Lo unico que se pierde es el contador, que cae a cero.
  assert.equal(secciones[0].sectionalDestCount, 0);
});

test('sin secciones no hay nada que devolver, y el motivo sube', async () => {
  const res = await conFetch(
    (url) => (String(url).includes('GetAllSecciones') ? SE_AGOTO() : respuesta('{"data":[]}')),
    () => getSecciones()
  );

  assert.equal(res.status, 500);

  const cuerpo = await res.json();

  assert.match(cuerpo.message, /no respondió en 9s/);
});

test('las regiones se devuelven aunque las secciones no lleguen', async () => {
  const res = await conFetch(
    (url) => (String(url).includes('GetAllSecciones') ? SE_AGOTO() : respuesta(REGIONES)),
    () => getRegiones()
  );

  assert.equal(res.status, 200);

  const cuerpo = await res.json();
  const regiones = cuerpo?.data ?? cuerpo?.Data ?? [];

  assert.equal(regiones.length, 1);
  assert.equal(regiones[0].nombre, 'Region Centro');
  assert.equal(regiones[0].regionalXSectionalCount, 0);
});
