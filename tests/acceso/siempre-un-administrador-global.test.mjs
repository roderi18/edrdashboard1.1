import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ROLES_DE_ADMINISTRACION } = await import('src/utils/admin-role-label.js');

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

const RUTA = 'src/app/api/admin/asignar-rol-administracion/route.js';

// ----------------------------------------------------------------------
// NUNCA CERO ADMINISTRADORES GLOBALES, Y LA ESCRITURA POR EL SERVIDOR.
//
// Dos cosas que se descubrieron juntas:
//
//   1. `usuarios_roles` es `allow write: if false` en firestore.rules, pero la
//      pantalla de administradores guardaba con `setDoc` DESDE EL CLIENTE. La
//      escritura moria en las reglas: la pantalla decia "guardado" y el documento
//      seguia igual. Lo mismo al quitar un cargo.
//   2. Nada impedia quitarle el cargo al ultimo Administrador Global. Es la unica
//      cuenta que reparte cargos: sin ninguna, no queda nadie que pueda nombrar a
//      la siguiente y la plataforma se cierra por dentro.
//
// Las dos se arreglan en el mismo sitio —una ruta de servidor— porque la segunda
// no se puede comprobar donde se puede saltar.
// ----------------------------------------------------------------------

test('la asignacion pasa por el servidor, no por el navegador', () => {
  const cliente = leer('src/auth/permissions/firebase-permissions.js');

  assert.match(cliente, /fetch\('\/api\/admin\/asignar-rol-administracion\/'/);
  // Y devuelve lo que escribio el servidor, no lo que creia el navegador.
  assert.match(cliente, /return data\?\.asignacion \|\| payload;/);
  // El `setDoc` que habia DENTRO de `guardarAsignacionRolUsuario` ya no esta. Los
  // que quedan en el archivo son de otras funciones —guardar permisos sueltos, por
  // ejemplo—, que no cambian el cargo y no pasan por esta puerta.
  const cuerpoDelRol = cliente.slice(
    cliente.indexOf('export async function guardarAsignacionRolUsuario'),
    cliente.indexOf('export async function sincronizarRolPorCargo')
  );
  assert.ok(cuerpoDelRol.length > 0, 'se localiza la funcion del rol');
  assert.doesNotMatch(cuerpoDelRol, /setDoc\(/);
});

test('quitar el cargo pasa por la MISMA puerta', () => {
  const admins = leer('src/utils/firebase-admins.js');

  assert.match(admins, /fetch\('\/api\/admin\/asignar-rol-administracion\/'/);
  assert.match(admins, /rolId: 'usuario_comun'/);
  // Un camino propio para quitar seria el camino por el que se escaparia la regla.
  assert.doesNotMatch(admins, /updateDoc\(roleProfile\.ref/);
});

test('la ruta exige que quien reparte sea el Administrador Global', () => {
  const ruta = leer(RUTA);

  assert.match(ruta, /if \(suRol !== ROLES\.ADMINISTRADOR_GLOBAL\)/);
  assert.match(ruta, /Solo el Administrador Global reparte cargos de administración\./);
  assert.match(ruta, /403/);
});

test('la ruta solo acepta los cuatro cargos de administracion, o quitarlo', () => {
  const ruta = leer(RUTA);

  assert.match(
    ruta,
    /const DESTINOS_VALIDOS = \[\.\.\.ROLES_DE_ADMINISTRACION, ROLES\.USUARIO_COMUN\]/
  );
  assert.match(ruta, /if \(!DESTINOS_VALIDOS\.includes\(cargoNuevo\)\)/);

  // La lista del servidor y la del cliente son la misma, en el mismo orden. Estan
  // escritas dos veces a proposito —la regla del servidor no depende de un modulo
  // de navegador— y esto es lo que impide que se separen.
  const listaDeLaRuta = ruta
    .match(/const ROLES_DE_ADMINISTRACION = \[([\s\S]*?)\];/)[1]
    .split(',')
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith('ROLES.'))
    .map((linea) => linea.replace('ROLES.', ''));

  assert.deepEqual(listaDeLaRuta, [
    'ADMINISTRADOR_GLOBAL',
    'ADMINISTRADOR_FUNCIONAL',
    'ADMINISTRADOR_TIENDA',
    'OFICINA_NACIONAL',
  ]);
  assert.equal(listaDeLaRuta.length, ROLES_DE_ADMINISTRACION.length);
});

test('la ruta no deja la organizacion sin Administrador Global', () => {
  const ruta = leer(RUTA);

  // Solo importa cuando el que cambia ES el global y deja de serlo.
  assert.match(
    ruta,
    /if \(eraAdministradorGlobal && cargoNuevo !== ROLES\.ADMINISTRADOR_GLOBAL\)/
  );
  // Se descuentan TODOS los documentos de la persona (su uid y su numero).
  assert.match(ruta, /const quedan = await otrosAdministradoresGlobales\(db, documentos\)/);
  assert.match(ruta, /if \(quedan === 0\)/);
  assert.match(ruta, /Es el único Administrador Global/);
  assert.match(ruta, /409/);
});

test('el recuento se hace por rolId y descontando al propio afectado', () => {
  const ruta = leer(RUTA);

  assert.match(ruta, /\.where\('rolId', '==', ROLES\.ADMINISTRADOR_GLOBAL\)/);
  // Sin descontarlo, el que todavia tiene el cargo se contaria a si mismo y la
  // comprobacion nunca saltaria.
  assert.match(ruta, /!excluidos\.has\(String\(documento\.id\)\)/);
});

test('el cambio se escribe antes de emitir los claims, y un claim fallido no lo tumba', () => {
  const ruta = leer(RUTA);
  const posicionEscritura = ruta.indexOf('.set(datos, { merge: true })');
  const posicionClaims = ruta.indexOf('setCustomUserClaims');

  assert.ok(posicionEscritura > 0, 'la ruta escribe el documento');
  assert.ok(
    posicionEscritura < posicionClaims,
    'primero se guarda el cargo y despues se emiten los claims'
  );
  assert.match(ruta, /no se pudieron emitir los claims/);
});
