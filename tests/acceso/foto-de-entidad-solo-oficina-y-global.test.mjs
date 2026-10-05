// ----------------------------------------------------------------------
// LA FOTO DE UN DESTACAMENTO, SECCIÓN O REGIÓN: SOLO OFICINA NACIONAL Y
// ADMINISTRADOR GLOBAL.
//
// Qué se rompía: los coordinadores de cada nivel veían el botón de cambiar la
// foto y la mandaban a aprobar; se pidió que solo la cambien la Oficina
// Nacional y el Administrador Global. La Oficina es un rol a mano: cuenta
// aunque no sea el cargo principal.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { puedeCambiarFotoDeEntidad } = await import('../../src/utils/org-level-access.js');

test('el Administrador Global y la Oficina Nacional cambian la foto', () => {
  assert.equal(puedeCambiarFotoDeEntidad({ rolId: 'administrador_global' }), true);
  assert.equal(puedeCambiarFotoDeEntidad({ rolId: 'oficina_nacional' }), true);
});

test('la Oficina Nacional fuera del cargo principal también', () => {
  const usuario = {
    rolId: 'usuario_region',
    cargos: [
      { rol: 'usuario_region', nivel: 'region', idEntidad: '3' },
      { rol: 'oficina_nacional', nivel: 'nacional' },
    ],
  };
  assert.equal(puedeCambiarFotoDeEntidad(usuario), true);
});

test('los coordinadores de destacamento, sección y región ya no', () => {
  for (const rolId of ['usuario_destacamento', 'usuario_seccion', 'usuario_region']) {
    assert.equal(puedeCambiarFotoDeEntidad({ rolId }), false, rolId);
  }
});
