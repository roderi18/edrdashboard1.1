// ----------------------------------------------------------------------
// LO YA LEÍDO NO SE VUELVE A PEDIR AL VOLVER A UNA PANTALLA.
//
// Qué se rompía: cada pantalla y cada pestaña de los niveles organizacionales
// repetía las mismas lecturas (API .NET y Firestore) y enseñaba el esqueleto
// aunque lo hubiera visto hacía un momento. La caché reparte lo leído, relee
// por detrás lo viejo y olvida lo que una escritura cambió.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { leerConCache, valorGuardado, invalidarLecturas } = await import(
  'src/utils/cache-de-lecturas.mjs'
);

const contador = (valor) => {
  const lector = async () => {
    lector.veces += 1;
    return typeof valor === 'function' ? valor(lector.veces) : valor;
  };
  lector.veces = 0;
  return lector;
};

test('una segunda lectura sale de memoria, sin volver a pedir', async () => {
  const leer = contador(['a', 'b']);

  assert.deepEqual(await leerConCache('prueba:1', leer), ['a', 'b']);
  assert.deepEqual(await leerConCache('prueba:1', leer), ['a', 'b']);
  assert.equal(leer.veces, 1);
});

test('dos pantallas que piden lo mismo a la vez comparten la petición', async () => {
  const leer = contador([1]);

  await Promise.all([leerConCache('prueba:2', leer), leerConCache('prueba:2', leer)]);
  assert.equal(leer.veces, 1);
});

test('lo viejo se entrega al momento y se relee por detrás', async () => {
  const leer = contador((vez) => [vez]);

  assert.deepEqual(await leerConCache('prueba:3', leer, { frescuraMs: 0 }), [1]);
  // Vieja: entrega la de antes sin esperar...
  assert.deepEqual(await leerConCache('prueba:3', leer, { frescuraMs: 0 }), [1]);
  await new Promise((resolver) => setTimeout(resolver, 0));
  // ...y la siguiente ya trae la releída.
  assert.deepEqual(valorGuardado('prueba:3'), [2]);
});

test('una escritura invalida lo suyo y la siguiente lectura va a la red', async () => {
  const leer = contador((vez) => vez);

  await leerConCache('regiones:x', leer);
  await leerConCache('otra:x', leer);
  invalidarLecturas('regiones');

  assert.equal(valorGuardado('regiones:x'), undefined);
  assert.equal(valorGuardado('otra:x'), 2);
});

test('lo leído mientras se invalidaba no resucita lo viejo', async () => {
  let soltar;
  const leer = () =>
    new Promise((resolver) => {
      soltar = resolver;
    });

  const enVuelo = leerConCache('prueba:5', leer);
  await Promise.resolve();
  invalidarLecturas('prueba:5');
  soltar('de antes de escribir');
  await enVuelo;

  assert.equal(valorGuardado('prueba:5'), undefined);
});

test('un fallo no se guarda: la próxima llamada lo reintenta', async () => {
  let veces = 0;
  const leer = async () => {
    veces += 1;
    if (veces === 1) throw new Error('API caída');
    return 'bien';
  };

  await assert.rejects(leerConCache('prueba:6', leer));
  assert.equal(await leerConCache('prueba:6', leer), 'bien');
});

test('ordenar la lista recibida no ensucia la guardada', async () => {
  const leer = contador([3, 1, 2]);

  (await leerConCache('prueba:7', leer)).sort();
  assert.deepEqual(await leerConCache('prueba:7', leer), [3, 1, 2]);
});

test('conCache guarda por argumentos y conInvalidacion la vacía al escribir', async () => {
  const { conCache, conInvalidacion } = await import('src/utils/cache-de-lecturas.mjs');
  const leer = contador((vez) => vez);
  const obtener = conCache('servicio-prueba', leer);
  const guardar = conInvalidacion(async () => 'ok');

  assert.equal(await obtener({ id: 1 }), 1);
  assert.equal(await obtener({ id: 1 }), 1);
  assert.equal(await obtener({ id: 2 }), 2);
  assert.equal(await guardar(), 'ok');
  assert.equal(await obtener({ id: 1 }), 3);
});

test('una escritura frecuente solo vacía su prefijo', async () => {
  const { conCache, conInvalidacion } = await import('src/utils/cache-de-lecturas.mjs');
  const leer = contador((vez) => vez);
  const obtener = conCache('lista-estable', leer);
  const registrarVisita = conInvalidacion(async () => {}, ['analiticas:']);

  await obtener();
  await registrarVisita();
  assert.equal(await obtener(), 1);
});
