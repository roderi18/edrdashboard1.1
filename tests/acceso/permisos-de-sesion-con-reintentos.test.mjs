// ----------------------------------------------------------------------
// LA SESION NO SE QUEDA "A MEDIAS" EN SILENCIO.
//
// Que se rompia: al entrar, la sesion se publicaba con lo minimo y los cargos
// llegaban despues. Si esa lectura se pasaba de tiempo devolvia `null` —igual que
// "no tiene cargos"—, el error se tragaba, la sesion se quedaba sin las opciones
// de administrador y se guardaba asi en la cache 30 minutos. Solo recargar o
// limpiar la cache lo arreglaba. Ahora "no respondio" se distingue de "no tiene",
// se reintenta, y lo incompleto no se cachea ni pisa una sesion ya resuelta.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { conReintentos, SIN_RESPUESTA, ESPERAS_DE_REINTENTO_MS } =
  await import('../../src/utils/permisos-con-reintentos.mjs');

const sinEspera = { esperar: async () => {} };

test('una lectura que falla una vez se reintenta y acaba dando los permisos', async () => {
  let llamadas = 0;

  const resultado = await conReintentos(async () => {
    llamadas += 1;
    if (llamadas < 3) throw new Error('permisos-sin-respuesta');
    return { rolesQueEjerce: ['administrador_global'] };
  }, sinEspera);

  assert.equal(llamadas, 3);
  assert.deepEqual(resultado.rolesQueEjerce, ['administrador_global']);
});

test('si agota los intentos relanza el error en vez de darlo por bueno', async () => {
  let llamadas = 0;

  await assert.rejects(
    conReintentos(async () => {
      llamadas += 1;
      throw new Error('permisos-sin-respuesta');
    }, sinEspera),
    /permisos-sin-respuesta/
  );

  assert.equal(llamadas, ESPERAS_DE_REINTENTO_MS.length + 1);
});

test('si entra otra cuenta mientras reintenta, se detiene sin error', async () => {
  let vigente = true;
  let llamadas = 0;

  const resultado = await conReintentos(
    async () => {
      llamadas += 1;
      vigente = false;
      throw new Error('permisos-sin-respuesta');
    },
    { ...sinEspera, sigueVigente: () => vigente }
  );

  assert.equal(resultado, undefined);
  assert.equal(llamadas, 1);
});

test('"no respondio" no es lo mismo que "no tiene": son valores distintos', () => {
  assert.notEqual(SIN_RESPUESTA, null);
  assert.equal(typeof SIN_RESPUESTA, 'symbol');
});

// El proveedor es JSX (no se importa desde node --test): se comprueban por
// codigo las tres reglas que cierran la carrera.
const proveedor = await readFile(
  new URL('../../src/auth/components/context/firebase/auth-provider.jsx', import.meta.url),
  'utf8'
);

test('el proveedor solo cachea la sesion cuando esta completa', () => {
  assert.match(proveedor, /if \(listos && !incompletos\) writeCachedSession\(base\)/);
  assert.equal(
    (proveedor.match(/writeCachedSession\((?!null)/g) ?? []).length,
    1,
    'ninguna otra ruta debe guardar la sesion a medias'
  );
});

test('el proveedor no rebaja una sesion ya resuelta a la version minima', () => {
  assert.match(proveedor, /sesionPrevia/);
  assert.match(
    proveedor,
    /publicarSesion\(\{ \.\.\.sesionPrevia, accessToken \}, \{ listos: true \}\)/
  );
});

test('el proveedor avisa de lo incompleto en vez de tragarse el error', () => {
  assert.match(proveedor, /incompletos: true/);
  assert.match(proveedor, /permisosIncompletos: state\.permisosIncompletos/);
  assert.match(proveedor, /permisosListos: state\.permisosListos/);
});
