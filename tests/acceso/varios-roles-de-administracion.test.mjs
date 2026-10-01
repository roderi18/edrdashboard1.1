// ----------------------------------------------------------------------
// VARIOS ROLES DE ADMINISTRACIÓN EN UNA PERSONA, SIN CONFLICTO.
//
// Qué se rompía: cada cuenta guardaba UN rol de administración. Dar a Eliezer
// García (Coordinador de su destacamento y Oficina Nacional) el de
// Administrador de Gestión de Tienda le quitaba la Oficina Nacional, y las
// comprobaciones de tienda solo miraban el rol principal. Ahora se suman, y
// cada fila de "no debe poder" de la tabla acordada tiene aquí su prueba.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  conRolDeAdministracion,
  sinRolDeAdministracion,
  rolesDeAdministracionDe,
  rolPrincipalDeAdministracion,
} = await import('../../src/utils/roles-de-administracion.mjs');
const { esCompraPropia, puedeGestionarEstaOrden } =
  await import('../../src/utils/compra-propia.mjs');
const { listaDeRolesQueEjerce } = await import('../../src/utils/lista-roles-que-ejerce.mjs');
const { can, puedeModificar, isReadOnlyRole } = await import('../../src/auth/permissions/can.js');
const { PERMISOS } = await import('../../src/auth/permissions/permissions.js');
const { canManageStoreProducts, canViewMemberAddressWhenMasked, filterDestsByMemberScope } =
  await import('../../src/utils/member-access.js');
const { requiereRevisionDeAdministradorGlobal, puedeCambiarFotoDeEntidad } =
  await import('../../src/utils/org-level-access.js');

const leer = (ruta) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');

// Eliezer: Coordinador de Destacamento (454) + Oficina Nacional + Tienda.
const eliezer = {
  uid: 'edr-10049',
  idMiembros: 383,
  rolId: 'oficina_nacional',
  rolesAdministracion: ['oficina_nacional', 'administrador_tienda'],
  cargos: [{ rol: 'usuario_destacamento', nivel: 'destacamento', idEntidad: '454' }],
  alcance: { modo: 'destacamento', destacamentos: ['454'] },
};

test('los roles se suman: añadir no reemplaza, quitar quita solo ese', () => {
  const conTienda = conRolDeAdministracion(['oficina_nacional'], 'administrador_tienda');
  assert.deepEqual(conTienda, ['oficina_nacional', 'administrador_tienda']);
  assert.deepEqual(sinRolDeAdministracion(conTienda, 'administrador_tienda'), ['oficina_nacional']);
  // Manda el de más rango.
  assert.equal(
    rolPrincipalDeAdministracion(['administrador_tienda', 'oficina_nacional']),
    'oficina_nacional'
  );
  // Las cuentas de antes de la lista: su rolId cuenta.
  assert.deepEqual(rolesDeAdministracionDe({ rolId: 'administrador_tienda' }), [
    'administrador_tienda',
  ]);
  // Lo que no es de administración no se cuela.
  assert.deepEqual(conRolDeAdministracion([], 'usuario_destacamento'), []);
});

test('la lista que leen las reglas lleva todos sus roles de administración', () => {
  assert.deepEqual(
    listaDeRolesQueEjerce({
      rolId: 'oficina_nacional',
      cargos: [{ rol: 'usuario_destacamento' }],
      rolesAdministracion: ['oficina_nacional', 'administrador_tienda'],
    }),
    ['oficina_nacional', 'administrador_tienda', 'usuario_destacamento']
  );
});

test('gestiona la tienda aunque la Oficina Nacional sea su rol principal', () => {
  assert.equal(canManageStoreProducts(eliezer), true);
  assert.equal(can(eliezer, PERMISOS.TIENDA_GESTIONAR), true);
  assert.equal(puedeModificar(eliezer, PERMISOS.TIENDA_GESTIONAR), true);
  // Dirección y teléfono de otros, para despachar.
  assert.equal(canViewMemberAddressWhenMasked(eliezer), true);
});

test('"solo lectura" de la Oficina Nacional no le bloquea la tienda (ni sin cargo de destacamento)', () => {
  const oficinaYTienda = {
    rolId: 'oficina_nacional',
    rolesAdministracion: ['oficina_nacional', 'administrador_tienda'],
  };
  const soloOficina = { rolId: 'oficina_nacional', rolesAdministracion: ['oficina_nacional'] };

  assert.equal(isReadOnlyRole(oficinaYTienda), false);
  assert.equal(isReadOnlyRole(soloOficina), true);
  // Solo Oficina no gestiona la tienda.
  assert.equal(canManageStoreProducts(soloOficina), false);
});

test('ve todos los destacamentos (Oficina Nacional)', () => {
  const dests = [{ id: '454' }, { id: '340' }];
  assert.equal(
    filterDestsByMemberScope(dests, eliezer, { churches: [], sectionals: [] }).length,
    2
  );
  assert.equal(puedeCambiarFotoDeEntidad(eliezer), true);
});

test('NO aprueba los cambios ni la foto de su propio destacamento: van al Global', () => {
  assert.equal(requiereRevisionDeAdministradorGlobal(eliezer, 'destacamento'), true);
  assert.equal(requiereRevisionDeAdministradorGlobal(eliezer, 'foto_destacamento'), true);
});

test('NO gestiona su propia compra (salvo el Administrador Global)', () => {
  const suya = { usuarioId: 'edr-10049', miembroId: '383' };
  const ajena = { usuarioId: 'otro', miembroId: '999' };

  assert.equal(esCompraPropia(suya, eliezer), true);
  assert.equal(puedeGestionarEstaOrden(suya, eliezer), false);
  assert.equal(puedeGestionarEstaOrden(ajena, eliezer), true);
  // La de la pantalla (customer.*) también.
  assert.equal(esCompraPropia({ customer: { memberId: '383' } }, eliezer), true);
  // El Global sí puede con la suya.
  assert.equal(puedeGestionarEstaOrden(suya, eliezer, { esAdministradorGlobal: true }), true);

  const servicio = leer('src/services/order-service.js');
  assert.equal((servicio.match(/throw new Error\(MENSAJE_COMPRA_PROPIA\)/g) || []).length, 2);
});

test('NO reparte roles: la ruta sigue siendo solo del Administrador Global, y suma o quita uno', () => {
  const ruta = leer('src/app/api/admin/asignar-rol-administracion/route.js');

  assert.match(ruta, /if \(suRol !== ROLES\.ADMINISTRADOR_GLOBAL\)/);
  assert.match(
    ruta,
    /accionNormalizada === 'agregar'\s*\? conRolDeAdministracion\(rolesPrevios, cargoNuevo\)/
  );
  assert.match(
    ruta,
    /: accionNormalizada === 'quitar'\s*\? sinRolDeAdministracion\(rolesPrevios, cargoNuevo\)/
  );
  assert.match(ruta, /rolesAdministracion: rolesNuevos,/);
});

test('la sincronización al entrar conserva todos sus roles de administración', () => {
  assert.match(leer('src/app/api/auth/sincronizar-rol/route.js'), /rolesAdministracion,\s*\}\);/);
  assert.match(
    leer('src/app/api/admin/sincronizar-roles/route.js'),
    /rolesAdministracion,\s*\}\);/
  );
  assert.match(
    leer('src/server/rol-por-cargo.js'),
    /rolesAdministracion: susRolesDeAdministracion,/
  );
});

test('las reglas reconocen la Tienda aunque no sea el rol principal', () => {
  assert.match(leer('firestore.rules'), /\|\| ejerceRol\('administrador_tienda'\)/);
  assert.match(leer('storage.rules'), /rolesQueEjerce\.hasAny\(\['administrador_tienda'\]\)/);
});
