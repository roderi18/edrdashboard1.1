// ----------------------------------------------------------------------
// ARRASTRAR UNA CASILLA NO SE LLEVA A LAS QUE CUELGAN DE ELLA.
//
// Qué se rompía: el desplazamiento vive en el <li> del arbol, que contiene a
// las hijas, así que mover al Director movía todo lo de debajo. Ahora cada
// casilla se mueve sola y las hijas se compensan; para mover varias juntas se
// marcan con Ctrl + clic.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { factoresDelArrastre } = await import('src/utils/organigrama-arrastre.mjs');

// director arrastra a consejo y capellan; consejo arrastra a sub-director.
const padreDe = new Map([
  ['consejo', 'director'],
  ['capellan', 'director'],
  ['sub', 'consejo'],
]);

test('mover una casilla sola: ella con el puntero, sus hijas en contra', () => {
  assert.deepEqual(factoresDelArrastre(['director'], padreDe), {
    director: 1,
    consejo: -1,
    capellan: -1,
  });
});

test('una hoja se mueve sola y no toca a nadie más', () => {
  assert.deepEqual(factoresDelArrastre(['capellan'], padreDe), { capellan: 1 });
});

test('padre e hija marcados juntos: la hija ya va con el padre y no se compensa', () => {
  assert.deepEqual(factoresDelArrastre(['director', 'consejo'], padreDe), {
    director: 1,
    capellan: -1,
    sub: -1,
  });
});

test('dos hermanas marcadas se mueven las dos, sin tocar al padre', () => {
  assert.deepEqual(factoresDelArrastre(['consejo', 'capellan'], padreDe), {
    consejo: 1,
    capellan: 1,
    sub: -1,
  });
});

test('una casilla sin nadie que la arrastre (la raíz) se mueve sola', () => {
  assert.deepEqual(factoresDelArrastre(['raiz'], new Map()), { raiz: 1 });
});
