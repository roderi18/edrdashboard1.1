import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { can } = await import('src/auth/permissions/can.js');
const { PERMISOS } = await import('src/auth/permissions/permissions.js');
const { ALCANCE_PREDETERMINADO_ROL } = await import(
  'src/auth/permissions/role-permissions.js'
);

const administradorTienda = { rolId: 'administrador_tienda' };

test('el Administrador de Gestion de Tienda puede consultar destacamentos', () => {
  assert.equal(can(administradorTienda, PERMISOS.DESTACAMENTOS_VER), true);
});

test('su alcance es global para ver todos los destacamentos del pais', () => {
  assert.equal(ALCANCE_PREDETERMINADO_ROL.administrador_tienda, 'global');
});

test('consultar destacamentos no le concede gestion sobre ellos', () => {
  assert.equal(can(administradorTienda, PERMISOS.DESTACAMENTOS_CREAR), false);
  assert.equal(can(administradorTienda, PERMISOS.DESTACAMENTOS_EDITAR), false);
  assert.equal(can(administradorTienda, PERMISOS.DESTACAMENTOS_ELIMINAR), false);
});
