// ----------------------------------------------------------------------
// LOS MIEMBROS CON CARGO VEN SUS ÓRDENES Y SUS RECIBOS.
//
// Qué se rompía: "Tienda Virtual" pasó a ser un enlace directo (sin hijos) y el
// filtro del menú solo armaba el desplegable de cliente —Lista de productos,
// Mis ordenes, Mis recibos— cuando la entrada traía `children`. Ningún miembro
// con cargo, el Consejo Ejecutivo incluido, llegaba a sus órdenes ni a sus
// recibos desde el menú. Las pantallas ya estaban abiertas y filtran lo suyo.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { filterDashboardNavDataByUser } = await import('src/utils/member-access.js');
const { paths } = await import('src/routes/paths.js');
const { buildDefaultMemberPermissions } = await import('src/utils/member-default-permissions.js');

// Como llega una sesion de miembro de verdad: con los permisos de cualquier miembro.
const sesion = (rol) => ({
  uid: 'u1',
  rol: 'miembro',
  rolId: rol,
  cargos: [{ rol }],
  permisos: buildDefaultMemberPermissions(),
});

const menu = [
  {
    subheader: 'Tienda',
    items: [
      { title: 'Tienda Virtual', path: paths.dashboard.product.root, deepMatch: true },
      { title: 'Mi carrito', path: paths.dashboard.checkout },
    ],
  },
];

const tiendaDe = (user) =>
  filterDashboardNavDataByUser(menu, user)
    .flatMap((seccion) => seccion.items)
    .find((item) => item.title === 'Tienda Virtual');

test('un cargo del Consejo Ejecutivo ve Mis ordenes y Mis recibos', () => {
  const tienda = tiendaDe(sesion('coordinador_programa_nacional'));

  assert.ok(tienda, 'sale Tienda Virtual');
  assert.deepEqual(
    tienda.children.map((hijo) => hijo.path),
    [paths.dashboard.product.root, paths.dashboard.order.root, paths.dashboard.invoice.root]
  );
  assert.ok(tienda.children.some((hijo) => hijo.title === 'Mis recibos'));
});

test('"Mi carrito" sigue como enlace propio', () => {
  const items = filterDashboardNavDataByUser(menu, sesion('director_nacional')).flatMap(
    (seccion) => seccion.items
  );

  assert.ok(items.some((item) => item.path === paths.dashboard.checkout && !item.children));
});
