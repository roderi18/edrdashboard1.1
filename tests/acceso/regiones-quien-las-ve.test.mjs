import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { puedeVerTodasLasRegiones, puedeEntrarALaRegion } = await import(
  'src/utils/org-level-access.js'
);

// ----------------------------------------------------------------------
// Quien ve TODAS las regiones, y quien entra en cual.
//
// Las ven todas los cargos de nivel region, los de nivel nacional —Consejo
// Nacional y sus cargos, Consejo Ejecutivo y Oficina Nacional— y los
// administradores Global y Funcional. A los demas se les listan igual, pero
// deshabilitadas, y su ficha no se abre ni con el enlace pegado.
// ----------------------------------------------------------------------

const sesion = (rolId, nivel = 'destacamento', idEntidad = '231') => ({
  role: 'member',
  rol: 'miembro',
  rolId,
  memberRole: rolId,
  idMiembros: 900,
  cargos: rolId ? [{ rol: rolId, nivel, idEntidad }] : [],
  alcance: { modo: 'destacamento', tipo: 'destacamento', destacamentos: [], secciones: [], regiones: [] },
});

const LAS_VEN_TODAS = [
  ['Coordinador Regional', sesion('usuario_region', 'regional', 'R1')],
  ['Sub-Director Regional', sesion('usuario_region_asistente', 'regional', 'R1')],
  ['Coordinador de Adiestramiento Regional', sesion('coordinador_adiestramiento_region', 'regional', 'R1')],
  ['Capellán Regional', sesion('capellan_regional', 'regional', 'R1')],
  ['Secretario Regional', sesion('secretario_regional', 'regional', 'R1')],
  ['Consejo Nacional', sesion('consejo_nacional', 'nacional', '')],
  ['Director Nacional', sesion('director_nacional', 'nacional', '')],
  ['Consejo Ejecutivo', sesion('consejo_ejecutivo', 'nacional', '')],
  ['Oficina Nacional', sesion('oficina_nacional', 'nacional', '')],
  ['Administrador Global', { role: 'admin', rolId: 'administrador_global' }],
  ['Administrador Funcional', { role: 'admin', rolId: 'administrador_funcional' }],
];

const SOLO_LA_SUYA = [
  ['Usuario Común', sesion('')],
  ['Pastor de Destacamento', sesion('pastor_destacamento')],
  ['Coordinador de Destacamento', sesion('usuario_destacamento')],
  ['Coordinador Asistente', sesion('usuario_destacamento_asistente')],
  ['Líder de Grupo', sesion('lider_grupo')],
  ['Coordinador Seccional', sesion('usuario_seccion', 'seccional', 'A')],
  ['Sub-Coordinador Seccional', sesion('usuario_seccion_asistente', 'seccional', 'A')],
  ['Coordinador de Programa Seccional', sesion('coordinador_programa_seccion', 'seccional', 'A')],
  ['Capellán Seccional', sesion('capellan_seccional', 'seccional', 'A')],
  ['Zonas', sesion('zonas', 'seccional', 'A')],
  ['Grupos Locales', sesion('grupos_locales', 'seccional', 'A')],
  // Su alcance es global por catalogo, pero no gobierna la estructura.
  ['Administrador de Tienda', { role: 'admin', rolId: 'administrador_tienda' }],
];

const SUYA = new Set(['R1']);

for (const [nombre, user] of LAS_VEN_TODAS) {
  test(`${nombre} ve todas las regiones y entra en cualquiera`, () => {
    assert.equal(puedeVerTodasLasRegiones(user), true);
    assert.equal(puedeEntrarALaRegion(user, 'R2', { ownRegionIds: SUYA }), true);
  });
}

for (const [nombre, user] of SOLO_LA_SUYA) {
  test(`${nombre} no entra en una region ajena ni con el enlace`, () => {
    assert.equal(puedeVerTodasLasRegiones(user), false);
    assert.equal(puedeEntrarALaRegion(user, 'R2', { ownRegionIds: SUYA }), false);
  });
}

test('en la suya si entra quien la tiene', () => {
  assert.equal(
    puedeEntrarALaRegion(sesion('usuario_destacamento'), 'R1', { ownRegionIds: SUYA }),
    true
  );
});

// Sin region que comparar no se deja entrar: la puerta se abre por lo que se
// sabe, no por lo que falta.
test('sin region resuelta no se entra a ninguna', () => {
  assert.equal(puedeEntrarALaRegion(sesion('usuario_destacamento'), 'R1'), false);
  assert.equal(puedeEntrarALaRegion(sesion('usuario_seccion', 'seccional', 'A'), ''), false);
});
