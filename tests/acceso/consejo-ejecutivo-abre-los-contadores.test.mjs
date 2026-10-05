// ----------------------------------------------------------------------
// EL CONSEJO EJECUTIVO ABRE LOS CONTADORES DE TODOS LOS NIVELES.
//
// Qué se rompía: en Regiones, los contadores de Secciones, Destacamentos y
// Miembros salían atenuados y sin enlace para los diez cargos del Consejo
// Ejecutivo; en Secciones, el de Miembros. La lista de miembros y el contador de
// destacamentos ya los dejaban ver todo (nivel nacional); solo faltaba abrir los
// de regiones y secciones. Se cuenta por TODOS sus cargos: con uno de
// destacamento además, sigue mandando el nacional para ver.
//
// Después se sumó: en /member ven a todos (con "Solo ver miembros de mi
// destacamento", como el Administrador Global) y en su perfil cambian todos sus
// datos.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  ROLES_CONSEJO_EJECUTIVO,
  isForeignDestForMembers,
  isForeignRegionForMembers,
  isForeignSectionForMembers,
  canBrowseOrgStructureCounts,
} = await import('../../src/utils/org-level-access.js');

const sinNada = { ownRegionIds: new Set(), ownSectionIds: new Set(), ownDestIds: new Set() };
const conCargo = (rol, extra = []) => ({
  rolId: rol,
  cargos: [{ rol }, ...extra.map((r) => ({ rol: r }))],
});

test('los diez cargos del Consejo Ejecutivo pulsan secciones, destacamentos y miembros en todas partes', () => {
  assert.equal(ROLES_CONSEJO_EJECUTIVO.length, 10);

  ROLES_CONSEJO_EJECUTIVO.forEach((rol) => {
    const user = conCargo(rol);

    assert.equal(canBrowseOrgStructureCounts(user), true, rol);
    assert.equal(isForeignRegionForMembers(user, { regionId: '3', ...sinNada }), false, rol);
    assert.equal(
      isForeignSectionForMembers(user, { sectionId: '9', regionId: '3', ...sinNada }),
      false,
      rol
    );
    assert.equal(
      isForeignDestForMembers(user, { destId: '7', sectionId: '9', regionId: '3', ...sinNada }),
      false,
      rol
    );
  });
});

test('con un cargo de destacamento además, sigue abriendo (ver se suma entre cargos)', () => {
  const user = {
    rolId: 'usuario_destacamento',
    cargos: [{ rol: 'usuario_destacamento' }, { rol: 'coordinador_programa_nacional' }],
  };

  assert.equal(isForeignRegionForMembers(user, { regionId: '3', ...sinNada }), false);
  assert.equal(canBrowseOrgStructureCounts(user), true);
});

test('un cargo de sección no gana nada: los miembros de otra región siguen cerrados', () => {
  const user = conCargo('usuario_seccion');

  assert.equal(isForeignRegionForMembers(user, { regionId: '3', ...sinNada }), true);
});

test('en /member ve a todos los miembros, como el Administrador Global (con "Solo mi destacamento")', async () => {
  const { filterMembersByMemberScope } = await import('../../src/utils/member-access.js');
  const miembros = [
    { id: '1', idDestacamento: '10' },
    { id: '2', idDestacamento: '20' },
    { id: '3', idDestacamento: '30' },
  ];
  const consejo = {
    rolId: 'usuario_destacamento',
    rol: 'miembro',
    cargos: [{ rol: 'usuario_destacamento' }, { rol: 'capellan_nacional' }],
    alcance: { destacamentos: ['10'] },
  };

  assert.equal(filterMembersByMemberScope(miembros, consejo).length, 3);
  // El boton sale solo cuando la lista abarca varios destacamentos y hay uno propio.
  assert.match(
    readFileSync(
      new URL('../../src/sections/member/view/member-list-view.jsx', import.meta.url),
      'utf8'
    ),
    /mostrarFiltroSoloDestacamento =\s*!esPestanaDeDestacamento && Boolean\(idDestacamentoPropio\) && variosDestacamentosVisibles/
  );
});

test('en su perfil (/user/account) puede cambiar todos sus datos', () => {
  const perfil = readFileSync(
    new URL('../../src/sections/user-account/user-account-general.jsx', import.meta.url),
    'utf8'
  );

  assert.match(perfil, /isAdminGlobal\(user\) \|\|\s*ejerceConsejoEjecutivo\(user\);/);
});
