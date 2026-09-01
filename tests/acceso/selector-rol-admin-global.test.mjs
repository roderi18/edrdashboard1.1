import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';

const leer = (ruta) => fs.readFileSync(path.join(process.cwd(), ruta), 'utf8');

test('el selector queda limitado al correo autorizado en cliente y servidor', () => {
  const politica = leer('src/auth/permissions/admin-role-switch-policy.js');
  const selector = leer('src/layouts/components/workspaces-popover.jsx');
  const ruta = leer('src/app/api/admin/switch-own-role/route.js');

  assert.match(politica, /rdpr18@gmail\.com/);
  assert.match(selector, /puedeUsarSelectorDeRol\(user\?\.email \|\| user\?\.correo\)/);
  assert.match(ruta, /puedeUsarSelectorDeRol\(caller\.email\)/);
  assert.match(ruta, /puedeUsarSelectorDeRol\(authUser\.email\)/);
  assert.match(ruta, /esPerfilAdministradorGlobal\(perfilAdmin\)/);
  assert.match(ruta, /collection\('admins'\).*where\('uid', '==', caller\.uid\)/s);
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
