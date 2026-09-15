import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// EL CARGO DE ADMINISTRACION LLEGA A LA CUENTA CON LA QUE SE ENTRA.
//
// A EDR-10002 se le dio "Administrador de Gestion de Tienda" desde
// Administradores y entro sin un solo permiso de la tienda. La pantalla mando su
// NUMERO de miembro (326) y el cargo se guardo en `usuarios_roles/326`, mientras
// la sesion, las reglas y la sincronizacion leen `usuarios_roles/<uid>`, que
// seguia diciendo "Sub-Coordinador Seccional Asistente". Pasaba igual con los
// cuatro cargos: Global, Funcional, Tienda y Oficina Nacional.
//
// Lo que vigila esta suite: que la ruta encuentre las cuentas de Firebase de la
// persona por cualquier camino y escriba el cargo en ellas, conservando sus
// cargos de la directiva; y que, con el cargo puesto, la tienda le de lo mismo
// que al Administrador Global.
// ----------------------------------------------------------------------

const { resolverCuentasDelObjetivo } = await import('src/server/cuenta-del-objetivo.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

// Firebase de mentira con la forma del caso real.
const firebaseDe = ({ usuarios = {}, correos = {}, roles = {}, perfiles = [] }) => ({
  obtenerUsuario: async (uid) => {
    if (!usuarios[uid]) throw new Error('auth/user-not-found');
    return { uid };
  },
  obtenerPorCorreo: async (correo) => {
    if (!correos[correo]) throw new Error('auth/user-not-found');
    return { uid: correos[correo] };
  },
  leerRol: async (id) => roles[id] ?? null,
  buscarPerfiles: async (campo, valor) =>
    perfiles.filter((perfil) => perfil.data?.[campo] === valor),
});

test('con el numero de miembro, encuentra el uid con el que entra (el caso de EDR-10002)', async () => {
  const { uids, idMiembros, codigoMiembro } = await resolverCuentasDelObjetivo({
    idObjetivo: '326',
    ...firebaseDe({
      usuarios: { ZDvIItjKred3tE1eqcq6JK4noyv1: true },
      roles: { 326: { idMiembros: 326, codigoMiembro: 'EDR-10002' } },
      perfiles: [
        {
          id: 'ZDvIItjKred3tE1eqcq6JK4noyv1',
          data: { idMiembros: '326', rolId: 'usuario_seccion_asistente' },
        },
      ],
    }),
  });

  assert.deepEqual(uids, ['ZDvIItjKred3tE1eqcq6JK4noyv1']);
  assert.equal(idMiembros, '326');
  assert.equal(codigoMiembro, 'EDR-10002');
});

test('si solo hay codigo, lo encuentra por el correo interno de su codigo', async () => {
  const { uids } = await resolverCuentasDelObjetivo({
    idObjetivo: '326',
    ...firebaseDe({
      correos: { 'edr-10002@exploradores.app': 'uid-miembro' },
      roles: { 326: { codigoMiembro: 'EDR-10002' } },
    }),
  });

  assert.deepEqual(uids, ['uid-miembro']);
});

test('si ya viene el uid, se queda con el; y reune todas las cuentas de la persona', async () => {
  const { uids } = await resolverCuentasDelObjetivo({
    idObjetivo: 'uid-admin',
    correo: 'persona@test.do',
    ...firebaseDe({
      usuarios: { 'uid-admin': true },
      correos: { 'persona@test.do': 'uid-admin', 'edr-10009@exploradores.app': 'uid-codigo' },
      roles: { 'uid-admin': { idMiembros: 90, codigoMiembro: 'EDR-10009' } },
    }),
  });

  assert.deepEqual([...uids].sort(), ['uid-admin', 'uid-codigo']);
});

test('sin cuenta de acceso no inventa ninguna', async () => {
  const { uids } = await resolverCuentasDelObjetivo({ idObjetivo: '999', ...firebaseDe({}) });

  assert.deepEqual(uids, []);
});

test('la ruta escribe en cada cuenta, conserva sus cargos y emite los claims de cada una', () => {
  const ruta = leer('src/app/api/admin/asignar-rol-administracion/route.js');

  assert.ok(ruta.includes('resolverCuentasDelObjetivo({'));
  assert.ok(
    ruta.includes('const documentos = [...new Set([...cuentas.uids, String(uidUsuario)])];')
  );
  // Los cargos de la directiva no se borran: se usan los que ya tenia.
  assert.ok(
    ruta.includes('const susCargos = Array.isArray(cargos) ? cargos : (actual.cargos ?? []);')
  );
  assert.ok(
    ruta.includes(
      'rolesQueEjerce: listaDeRolesQueEjerce({ rolId: rolQueQueda, cargos: susCargos })'
    )
  );
  assert.ok(ruta.includes('cuentas.uids.map(async (uid) =>'));
  assert.ok(ruta.includes('await auth.setCustomUserClaims(uid, suyos);'));
  // Una cuenta de miembro sigue siendo de miembro.
  assert.ok(ruta.includes("const esCuentaDeMiembro = normalizar(actual.rol) === 'miembro';"));
});

test('el Administrador de Gestion de Tienda tiene la tienda como el Global, sea su cargo principal o no', () => {
  const acceso = leer('src/utils/member-access.js');
  const layout = leer('src/layouts/dashboard/layout.jsx');

  // Cuenta en cualquier posicion, no solo como rol principal.
  assert.ok(
    acceso.includes('rolesQueEjerce(user).some((codigo) => STORE_ADMIN_ROLE_IDS.has(codigo))')
  );
  // Borrar desde la ficha tambien.
  assert.ok(acceso.includes('isAdminGlobal(user) || canManageStoreProducts(user);'));
  // El menu de administracion de la tienda (Tienda, Ordenes, Recibos).
  assert.ok(layout.includes('esAdministradorGlobal || canManageStoreProducts(user)'));
});

test('el panel de la cuenta no enseña el correo y pone los cargos de administracion', () => {
  const panel = leer('src/layouts/components/account-drawer.jsx');

  assert.ok(!panel.includes('{realEmail}'));
  assert.ok(!panel.includes('{user?.email}'));
  assert.ok(panel.includes('cargosDeAdministracion.map((nombre) =>'));
  assert.ok(panel.indexOf('{cargos.map((cargo) =>') < panel.indexOf('cargosDeAdministracion.map('));
});
