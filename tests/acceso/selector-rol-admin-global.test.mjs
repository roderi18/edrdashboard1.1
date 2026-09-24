import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), 'utf8');

// DESDE f44d2456 EL SELECTOR ES DE CUALQUIER ADMINISTRADOR GLOBAL ACTIVO, no de
// un correo fijo. La barrera real sigue en el servidor: el correo del token
// tiene que ser el de Firebase Auth, y la cuenta tiene que tener en
// `usuarios_roles` la asignación activa de Administrador Global (o la marca de
// retorno `selectorRolAdminGlobal`, que solo escribe el servidor). En el cliente,
// el layout solo lo pinta al Administrador Global.
test('el selector queda limitado al Administrador Global activo en cliente y servidor', () => {
  const politica = leer('src/auth/permissions/admin-role-switch-policy.js');
  const layout = leer('src/layouts/dashboard/layout.jsx');
  const ruta = leer('src/app/api/admin/switch-own-role/route.js');

  // La lista de correos sigue mandando en "Probar como usuario".
  assert.match(politica, /rdpr18@gmail\.com/);
  assert.match(
    layout,
    /\(esAdministradorGlobal \|\| pruebaDeRolesActiva \|\| user\?\.selectorRolAdminGlobal\) && \(\s*<WorkspacesPopover/
  );
  assert.match(ruta, /normalizarRol\(authUser\.email\) !== normalizarRol\(caller\.email\)/);
  assert.match(ruta, /normalizarRol\(datosActuales\?\.rolId\) === 'administrador_global'/);
  assert.match(ruta, /datosActuales\?\.selectorRolAdminGlobal === true/);
  assert.match(ruta, /if \(!esAdministradorGlobalActivo && !tieneAccesoDeRetorno\)/);
});

test('el cambio usa Admin SDK y no abre usuarios_roles al navegador', () => {
  const cliente = leer('src/layouts/components/workspaces-popover.jsx');
  const ruta = leer('src/app/api/admin/switch-own-role/route.js');
  const reglas = leer('firestore.rules');

  assert.doesNotMatch(cliente, /guardarAsignacionRolUsuario/);
  assert.match(cliente, /cambiarRolPropioDesdeSelector/);
  assert.match(ruta, /collection\(COLECCION_USUARIOS_ROLES\)\.doc\(caller\.uid\)/);
  assert.match(ruta, /setCustomUserClaims\(caller\.uid, claims\)/);
  assert.match(reglas, /match \/usuarios_roles\/\{idUsuario\}[\s\S]*?allow write: if false;/);
});

test('el servidor valida el rol contra el catálogo', () => {
  const ruta = leer('src/app/api/admin/switch-own-role/route.js');

  assert.match(ruta, /ROLES_POR_CODIGO\[rolId\]/);
  assert.match(ruta, /if \(!rol\?\.activo\)/);
});

test('la sincronización por cargos no sobrescribe el rol manual de esta cuenta', () => {
  const sincronizacion = leer('src/app/api/auth/sincronizar-rol/route.js');

  assert.match(sincronizacion, /puedeUsarSelectorDeRol\(caller\.email\)/);
  assert.match(sincronizacion, /rol manual del Administrador Global/);
});
