// ----------------------------------------------------------------------
// EL ADMINISTRADOR GLOBAL REINA SOBRE CUALQUIER OTRO CARGO.
//
// Qué se rompía: EDR-10001 era Administrador Global y además tenía casillas en la
// directiva. Su sesión entraba con el cargo de la casilla como principal, la
// dominancia por módulo le daba el mando a ese cargo, y dejaba de ser
// Administrador Global en la pantalla: no le salía el lápiz de las cintas y sus
// propuestas de directiva quedaban pendientes de aprobación.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ejerceAdministradorGlobal, conAdministradorGlobalAlMando } =
  await import('../../src/utils/administrador-global-reina.mjs');
const { isAdminGlobal, getOrgRoleId } = await import('../../src/utils/org-level-access.js');
const { setModuloActivo, MODULOS } = await import('../../src/utils/modulo-activo.js');

const conCasillas = (extra = {}) => ({
  uid: 'edr-10001',
  rolId: 'usuario_region',
  cargos: [
    { rol: 'usuario_region', nivel: 'region', idEntidad: '3' },
    { rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: '52' },
    { rol: 'administrador_global', nivel: 'nacional' },
  ],
  ...extra,
});

test('Administrador Global entre sus cargos manda aunque el principal sea otro', () => {
  const usuario = conCasillas();

  assert.equal(ejerceAdministradorGlobal(usuario), true);

  for (const modulo of ['', ...Object.values(MODULOS)]) {
    setModuloActivo(modulo);
    assert.equal(getOrgRoleId(usuario), 'administrador_global', `módulo "${modulo}"`);
    assert.equal(isAdminGlobal(usuario), true, `módulo "${modulo}"`);
  }

  setModuloActivo('');
});

test('la sesión lo pone como principal y conserva sus otros cargos', () => {
  const sesion = conAdministradorGlobalAlMando(conCasillas());

  assert.equal(sesion.rolId, 'administrador_global');
  assert.equal(sesion.roleId, 'administrador_global');
  assert.equal(sesion.cargos.length, 3);
});

test('sin Administrador Global no cambia nada', () => {
  const usuario = { rolId: 'usuario_region', cargos: [{ rol: 'usuario_destacamento' }] };

  assert.equal(ejerceAdministradorGlobal(usuario), false);
  assert.equal(conAdministradorGlobalAlMando(usuario), usuario);
});

test('la sesión aplica la regla antes que la prueba de roles', async () => {
  const proveedor = await readFile(
    new URL('../../src/auth/components/context/firebase/auth-provider.jsx', import.meta.url),
    'utf8'
  );

  assert.match(
    proveedor,
    /const user = conAdministradorGlobalAlMando\(usuario\);\s*const simulacion = leerSimulacionDeRoles\(\);/
  );
});
