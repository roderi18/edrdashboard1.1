// ----------------------------------------------------------------------
// LAS PIEZAS DEL SANEADO DE EXPLORA DESIGNER.
//
// Lo que publica el Designer lo lee toda la organizacion en su portada. Estas
// piezas son las que impiden que se cuele lo que el proyecto no admite: un hex
// suelto en vez de un color de la paleta, un icono sin registrar que se descarga
// por internet y parpadea, o un boton que lleva a `javascript:` o a otro dominio.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  clave,
  icono,
  lista,
  texto,
  numero,
  destino,
  siTodoVale,
  acentoDeMarca,
  colorDeEstado,
  clavesSinRepetir,
} = await import('src/utils/everest/saneado.mjs');

test('texto: recorta, respeta el maximo y distingue lo obligatorio', () => {
  assert.equal(texto('  Hola  '), 'Hola');
  assert.equal(texto('', { obligatorio: true }), null);
  assert.equal(texto('   ', { obligatorio: true }), null);
  assert.equal(texto(''), '');
  assert.equal(texto(undefined), '');
  assert.equal(texto(42, { obligatorio: true }), null);
  assert.equal(texto('abcdef', { max: 5 }), null);
});

test('numero: solo numeros de verdad, dentro de sus limites', () => {
  assert.equal(numero(4.9, { min: 0, max: 5 }), 4.9);
  assert.equal(numero(6, { max: 5 }), null);
  assert.equal(numero(2.5, { entero: true }), null);
  assert.equal(numero('3'), null);
  assert.equal(numero(Number.NaN), null);
  assert.equal(numero(Infinity), null);
});

test('clave: minusculas, numeros y guiones, sin espacios', () => {
  assert.equal(clave('campamento-regional'), 'campamento-regional');
  assert.equal(clave('Campamento'), null);
  assert.equal(clave('con espacio'), null);
  assert.equal(clave('-empieza-mal'), null);
  assert.equal(clave('a'.repeat(61)), null);
});

test('icono: solo los del paquete registrado', () => {
  assert.equal(icono('solar:calendar-date-bold'), 'solar:calendar-date-bold');
  assert.equal(icono('custom:calendar-agenda-outline'), 'custom:calendar-agenda-outline');
  // Existe en Iconify, pero no esta registrado: se bajaria por internet.
  assert.equal(icono('mdi:rocket-launch'), null);
  assert.equal(icono('toString'), null);
});

test('colores: con nombre, nunca un hex suelto', () => {
  assert.equal(acentoDeMarca('verde'), 'verde');
  assert.equal(acentoDeMarca('#00B8D9'), null);
  assert.equal(colorDeEstado('success'), 'success');
  assert.equal(colorDeEstado('rgb(0,0,0)'), null);
});

test('destino: una ruta de la aplicacion o https, y nada mas', () => {
  assert.equal(destino('/dashboard/calendar'), '/dashboard/calendar');
  assert.equal(
    destino('https://exploradoresdelrey.org/evento'),
    'https://exploradoresdelrey.org/evento'
  );

  // eslint-disable-next-line no-script-url
  assert.equal(destino('javascript:alert(1)'), null);
  assert.equal(destino('//otro-sitio.com'), null);
  assert.equal(destino('/\\otro-sitio.com'), null);
  assert.equal(destino('http://inseguro.test'), null);
  assert.equal(destino('/dashboard/con espacio'), null);
  assert.equal(destino(''), null);
  assert.equal(destino(null), null);
});

test('lista: un solo elemento roto invalida la lista entera', () => {
  const soloPares = (n) => (n % 2 === 0 ? n : null);

  assert.deepEqual(lista([2, 4], soloPares), [2, 4]);
  assert.equal(lista([2, 3], soloPares), null);
  assert.equal(lista([2, 4, 6], soloPares, { max: 2 }), null);
  assert.equal(lista('no', soloPares), null);
  assert.deepEqual(lista([], soloPares), []);
});

test('un objeto vale solo si todas sus piezas valen', () => {
  assert.deepEqual(siTodoVale({ a: 1, b: '' }), { a: 1, b: '' });
  assert.equal(siTodoVale({ a: 1, b: null }), null);
});

test('las claves de una lista no se repiten', () => {
  assert.equal(clavesSinRepetir([{ clave: 'a' }, { clave: 'b' }]), true);
  assert.equal(clavesSinRepetir([{ clave: 'a' }, { clave: 'a' }]), false);
});
