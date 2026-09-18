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
    /: conAdministradorGlobalAlMando\(usuario\);\s*const simulacion = leerSimulacionDeRoles\(\);/
  );
});

// ----------------------------------------------------------------------
// "VER COMO USUARIO": quien tiene Administrador Global comprueba lo que ven los
// demás. Se le quita SOLO ese rol, y con él lo que lo delataba (`role: 'admin'`,
// permisos sueltos): si quedara algo, seguiría viéndolo todo y no probaría nada.
// ----------------------------------------------------------------------

const { sinAdministradorGlobal } = await import('../../src/utils/administrador-global-reina.mjs');
const { PERMISOS_POR_ROL, ALCANCE_PREDETERMINADO_ROL, RESTRICCIONES_ROL } =
  await import('../../src/auth/permissions/role-permissions.js');

const catalogo = {
  permisosPorRol: PERMISOS_POR_ROL,
  alcancePorRol: ALCANCE_PREDETERMINADO_ROL,
  restriccionesPorRol: RESTRICCIONES_ROL,
};

test('ver como usuario deja sus otros cargos, con el de mayor nivel como principal', () => {
  const vista = sinAdministradorGlobal(conCasillas({ role: 'admin' }), catalogo);

  assert.equal(vista.rolId, 'usuario_region');
  assert.equal(vista.role, 'usuario_region');
  assert.deepEqual(
    vista.cargos.map((cargo) => cargo.rol),
    ['usuario_region', 'usuario_destacamento']
  );
  assert.equal(ejerceAdministradorGlobal(vista), false);
  assert.equal(isAdminGlobal(vista), false);
  assert.deepEqual(vista.permisosDirectos, []);
  assert.equal(vista.verComoUsuario, true);
});

test('ver como usuario sin otros cargos queda como Usuario Común', () => {
  const vista = sinAdministradorGlobal(
    { rolId: 'administrador_global', role: 'admin', cargos: [], permisosDirectos: ['todo'] },
    catalogo
  );

  assert.equal(vista.rolId, 'usuario_comun');
  assert.equal(isAdminGlobal(vista), false);
  assert.deepEqual(vista.permisosRol, [...new Set(PERMISOS_POR_ROL.usuario_comun ?? [])]);
});

test('el botón está en el panel de la cuenta, encima de cerrar sesión', async () => {
  const panel = await readFile(
    new URL('../../src/layouts/components/account-drawer.jsx', import.meta.url),
    'utf8'
  );

  assert.match(panel, /'Ver como usuario'[\s\S]*<SignOutButton/);
  assert.match(panel, /cambiarVerComoUsuario\(!user\?\.verComoUsuario\)/);
});

// Con "Roles combinados" encendido, la sesion pasa a ser la pareja probada y el
// menu lateral se recortaba a lo de esos dos cargos: el Administrador Global
// perdia las pestañas para moverse durante la prueba. El menu sigue siendo el
// suyo; los permisos de la pareja los aplican los guardas de cada pantalla.
test('con roles combinados, el menu lateral sigue siendo el del Administrador Global', async () => {
  const leerFuente = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');
  const proveedor = await leerFuente('src/auth/components/context/firebase/auth-provider.jsx');
  const layout = await leerFuente('src/layouts/dashboard/layout.jsx');

  assert.ok(proveedor.includes('sesionSinPrueba: conAdministradorGlobalAlMando(usuario)'));
  assert.ok(
    layout.includes(
      'const usuarioDelMenu = (pruebaDeRolesActiva && user?.sesionSinPrueba) || user;'
    )
  );
  assert.ok(layout.includes('filterDashboardNavDataByUser(navDataConIndicadores, usuarioDelMenu)'));
});
