// ----------------------------------------------------------------------
// AL REABRIR LA APLICACIÓN, LO QUE NO ES DE NADIE SALE AL MOMENTO; LO DE LAS
// PERSONAS, NUNCA DEL DISCO.
//
// Qué se rompía: cada vez que se abría la aplicación, las listas de la
// organización volvían a esperar a la API (0,3 s a 17 s). Ahora las listas sin
// datos personales se guardan en el disco y salen al instante; el padrón, la
// salud y el resto solo viven en memoria. Otra cuenta en el mismo navegador
// empieza de cero, y quien escribe avisa a las demás sesiones.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const crearAlmacen = () => {
  const datos = new Map();
  return {
    get length() {
      return datos.size;
    },
    key: (indice) => [...datos.keys()][indice] ?? null,
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
    claves: () => [...datos.keys()],
  };
};

globalThis.localStorage = crearAlmacen();

const cache = await import('src/utils/cache-de-lecturas.mjs');

const olvidarMemoria = () => {
  // Simula reabrir la aplicación: la memoria se pierde, el disco no.
  cache.fijarDuenoDeLasLecturas(null);
  cache.fijarDuenoDeLasLecturas('ana');
};

test('las regiones se guardan en disco y salen al reabrir sin pedir nada', async () => {
  cache.fijarDuenoDeLasLecturas('ana');
  await cache.leerConCache('regiones:true', async () => ['Región Este']);

  olvidarMemoria();

  assert.deepEqual(cache.valorGuardado('regiones:true'), ['Región Este']);
});

test('el padrón nunca toca el disco', async () => {
  await cache.leerConCache('miembros:', async () => [{ telefono: '809' }]);

  assert.ok(!globalThis.localStorage.claves().some((clave) => clave.includes('miembros')));
});

test('otra cuenta en el mismo navegador no ve lo guardado por la anterior', async () => {
  cache.fijarDuenoDeLasLecturas('ana');
  await cache.leerConCache('secciones:true', async () => ['Sección 1']);

  cache.fijarDuenoDeLasLecturas('beto');

  assert.equal(cache.valorGuardado('secciones:true'), undefined);
});

test('invalidar borra también la copia del disco', async () => {
  cache.fijarDuenoDeLasLecturas('ana');
  await cache.leerConCache('iglesias:', async () => ['Iglesia']);
  cache.invalidarLecturas('iglesias:');

  assert.ok(!globalThis.localStorage.claves().some((clave) => clave.includes('iglesias')));
});

test('una escritura avisa a las demás sesiones con su prefijo, nunca con "todo"', async () => {
  const avisos = [];
  cache.registrarAvisador((prefijos) => avisos.push(prefijos));

  await cache.conInvalidacion(async () => {}, [], ['tienda-productos:'])();
  await cache.conInvalidacion(async () => {})();

  assert.deepEqual(avisos, [['tienda-productos:']]);
  cache.registrarAvisador(null);
});
