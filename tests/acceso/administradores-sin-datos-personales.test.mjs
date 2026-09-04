import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// El Administrador de Gestion de Tienda y el Administrador Funcional consultan,
// no acompañan. Ven la organizacion entera y la lista de miembros del pais, pero
// la informacion personal les llega enmascarada —salvo el telefono y, para la
// tienda, la direccion de envio— y el expediente medico y el historial quedan
// cerrados: se piden desde el aviso de la ficha.

const { can } = await import('src/auth/permissions/can.js');
const { PERMISOS } = await import('src/auth/permissions/permissions.js');
const {
  canEditAwards,
  canEditMembers,
  canEditParents,
  canViewMemberAwardsTab,
  canViewMemberHealthTab,
  canViewMemberParentsTab,
  canViewMemberHistoryTab,
  canViewMemberSensitiveData,
  canViewMemberAddressWhenMasked,
  puedeVerMiembrosDeTodaLaOrganizacion,
} = await import('src/utils/member-access.js');

const tienda = { rolId: 'administrador_tienda' };
const funcional = { rolId: 'administrador_funcional' };

// La misma cuenta con permisos pegados de una asignacion anterior: el catalogo
// manda, el token no reabre lo que el rol cerro.
const conTokenViejo = (usuario) => ({
  ...usuario,
  permisos: [PERMISOS.MIEMBROS_VER_DATOS_SENSIBLES, PERMISOS.SALUD_VER, PERMISOS.MIEMBROS_EDITAR],
});

test('el Administrador de Tienda consulta la estructura y los miembros del pais', () => {
  assert.equal(can(tienda, PERMISOS.MIEMBROS_VER), true);
  assert.equal(can(tienda, PERMISOS.SECCIONES_VER), true);
  assert.equal(can(tienda, PERMISOS.REGIONES_VER), true);
  assert.equal(can(tienda, PERMISOS.DESTACAMENTOS_VER), true);
  assert.equal(puedeVerMiembrosDeTodaLaOrganizacion(tienda), true);
});

test('consultar no es editar: la tienda no toca nada de la organizacion', () => {
  assert.equal(can(tienda, PERMISOS.SECCIONES_EDITAR), false);
  assert.equal(can(tienda, PERMISOS.REGIONES_EDITAR), false);
  assert.equal(can(tienda, PERMISOS.MIEMBROS_EDITAR), false);
  assert.equal(canEditMembers(tienda), false);
  assert.equal(canEditParents(tienda), false);
  assert.equal(canEditAwards(tienda), false);
});

test('la ficha le llega enmascarada, con la direccion de envio a la vista', () => {
  assert.equal(canViewMemberSensitiveData(tienda), false);
  assert.equal(canViewMemberAddressWhenMasked(tienda), true);
});

test('Dispensa Medica e Historial quedan cerrados para la tienda', () => {
  assert.equal(canViewMemberHealthTab(tienda), false);
  assert.equal(canViewMemberHistoryTab(tienda, { destId: '231' }), false);
});

test('Padres y Sistema de Ascenso si los consulta', () => {
  assert.equal(canViewMemberParentsTab(tienda), true);
  assert.equal(canViewMemberAwardsTab(tienda), true);
});

test('el Administrador Funcional deja de ver la informacion personal', () => {
  assert.equal(canViewMemberSensitiveData(funcional), false);
  assert.equal(canViewMemberAddressWhenMasked(funcional), false);
  assert.equal(canViewMemberHealthTab(funcional), false);
});

for (const [nombre, usuario] of [
  ['Administrador de Tienda', tienda],
  ['Administrador Funcional', funcional],
]) {
  test(`un token viejo no le devuelve al ${nombre} lo que el catalogo le cerro`, () => {
    const conPermisosPegados = conTokenViejo(usuario);

    assert.equal(canViewMemberSensitiveData(conPermisosPegados), false);
    assert.equal(canViewMemberHealthTab(conPermisosPegados), false);
    assert.equal(canEditMembers(conPermisosPegados), false);
  });
}
