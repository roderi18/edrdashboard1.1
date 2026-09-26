// ----------------------------------------------------------------------
// QUIÉN VE LA PESTAÑA "HISTORIA".
//
// Qué se rompía: la "Historia" del Consejo Nacional (quienes dejaron un cargo
// nacional, regional o seccional) la veía cualquiera que entrara a la lista, y
// es información de gobierno. Ahora la ven el Administrador Global, la Oficina
// Nacional y el Consejo Ejecutivo. El Consejo Ejecutivo ve también la de
// secciones y regiones, pero la de un destacamento solo si es el suyo; para los
// demás cargos la del destacamento no cambia.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { puedeVerHistoriaNacional } = await import('../../src/utils/org-level-access.js');
const { puedeVerHistoriaDeDestacamento } = await import('../../src/utils/member-access.js');

const directorNacional = {
  uid: 'director',
  rolId: 'director_nacional',
  cargos: [{ rol: 'director_nacional', nivel: 'nacional' }],
  idDestacamento: '231',
};

const consejoEjecutivo = {
  uid: 'consejo',
  rolId: 'consejo_ejecutivo',
  cargos: [{ rol: 'consejo_ejecutivo', nivel: 'nacional' }],
  idDestacamento: '231',
};

const oficinaNacional = { uid: 'oficina', rolId: 'oficina_nacional', cargos: [] };
const administradorGlobal = { uid: 'admin', rolId: 'administrador_global', cargos: [] };

const coordinadorDeDestacamento = {
  uid: 'coord',
  rolId: 'usuario_destacamento',
  cargos: [{ rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: '231' }],
  idDestacamento: '231',
};

test('la Historia del Consejo Nacional la ven Administrador Global, Oficina Nacional y Consejo Ejecutivo', () => {
  assert.equal(puedeVerHistoriaNacional(administradorGlobal), true);
  assert.equal(puedeVerHistoriaNacional(oficinaNacional), true);
  assert.equal(puedeVerHistoriaNacional(directorNacional), true);
  assert.equal(puedeVerHistoriaNacional(consejoEjecutivo), true);
});

test('un cargo de destacamento no ve la Historia del Consejo Nacional', () => {
  assert.equal(puedeVerHistoriaNacional(coordinadorDeDestacamento), false);
});

test('el Consejo Ejecutivo ve la Historia de su propio destacamento, no la de otro', () => {
  for (const usuario of [directorNacional, consejoEjecutivo]) {
    assert.equal(puedeVerHistoriaDeDestacamento(usuario, '231'), true);
    assert.equal(puedeVerHistoriaDeDestacamento(usuario, '999'), false);
  }
});

test('Administrador Global y Oficina Nacional ven la Historia de cualquier destacamento', () => {
  assert.equal(puedeVerHistoriaDeDestacamento(administradorGlobal, '999'), true);
  assert.equal(puedeVerHistoriaDeDestacamento(oficinaNacional, '999'), true);
});

test('para los demás cargos la Historia del destacamento no cambia', () => {
  assert.equal(puedeVerHistoriaDeDestacamento(coordinadorDeDestacamento, '231'), true);
});
