// ----------------------------------------------------------------------
// LAS MENCIONES SE VEN IGUAL AL ESCRIBIRLAS QUE AL ENVIARLAS.
//
// El mensaje enviado pintaba "@Fulano" del color de la casa y en negrita, y la
// caja donde se escribe lo dejaba del color del texto normal: la misma mencion
// cambiaba de aspecto al pulsar Enter. Cada pantalla tenia su propia regla para
// encontrarlas; ahora es esta, y es la que se prueba aqui.
// ----------------------------------------------------------------------

import assert from 'node:assert/strict';
import test from 'node:test';

import { tieneMenciones, partirPorMenciones } from '../../src/sections/chat/utils/menciones-en-el-texto.mjs';

const NOMBRES = ['Matías David Pérez Ramos', 'Ana', 'Ana María'];

test('un texto sin menciones vuelve entero y sin marcar', () => {
  assert.deepEqual(partirPorMenciones('hola, buenas', NOMBRES), [
    { texto: 'hola, buenas', esMencion: false },
  ]);
});

test('separa la mencion del resto del texto', () => {
  assert.deepEqual(partirPorMenciones('hola @Ana, ¿vienes?', NOMBRES), [
    { texto: 'hola ', esMencion: false },
    { texto: '@Ana', esMencion: true },
    { texto: ', ¿vienes?', esMencion: false },
  ]);
});

test('el nombre largo gana al corto que empieza igual', () => {
  // Con "Ana" delante, "@Ana María" quedaba partido en "@Ana" y " María": media
  // mencion coloreada y media no.
  assert.deepEqual(partirPorMenciones('@Ana María llega tarde', NOMBRES), [
    { texto: '@Ana María', esMencion: true },
    { texto: ' llega tarde', esMencion: false },
  ]);
});

test('varias menciones en el mismo mensaje', () => {
  const trozos = partirPorMenciones('@Ana y @Matías David Pérez Ramos', NOMBRES);

  assert.deepEqual(
    trozos.filter((trozo) => trozo.esMencion).map((trozo) => trozo.texto),
    ['@Ana', '@Matías David Pérez Ramos']
  );
});

test('una arroba suelta no es una mencion', () => {
  assert.equal(tieneMenciones('escríbeme a mi@correo.test', NOMBRES), false);
});

test('un nombre que no está en la conversación tampoco', () => {
  assert.equal(tieneMenciones('@Pedro Fuera', NOMBRES), false);
});

test('sin nadie delante no hay nada que reconocer', () => {
  assert.deepEqual(partirPorMenciones('@Ana', []), [{ texto: '@Ana', esMencion: false }]);
});

test('un nombre con parentesis no rompe la busqueda', () => {
  // El nombre entra en una expresion regular: sin escaparlo, "(" la invalidaba y
  // el chat se caia al escribir.
  assert.deepEqual(partirPorMenciones('hola @Ana (Anita)', ['Ana (Anita)']), [
    { texto: 'hola ', esMencion: false },
    { texto: '@Ana (Anita)', esMencion: true },
  ]);
});
