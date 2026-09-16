import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { canManageStoreProducts, filterDashboardNavDataByUser } =
  await import('src/utils/member-access.js');

// LA TIENDA ENTERA, DEBAJO DE "TIENDA", PARA QUIEN LA ADMINISTRA.
//
// Al reorganizar el menu en grupos por area de trabajo, "Tienda" se quedo en un
// enlace directo a la lista y Ordenes y Recibos bajaron al grupo de Desarrollo,
// al final de todo. El Administrador Global y el de Gestion de Tienda los
// buscaban debajo de "Tienda", que es donde estaban. El resto de los miembros
// sigue con su desplegable de cliente: Lista de productos, Mis ordenes, Mis
// recibos.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const menu = leer('src/layouts/nav-config-dashboard.jsx');
const layout = leer('src/layouts/dashboard/layout.jsx');

const bloqueTienda = menu.slice(
  menu.indexOf('export const tiendaDeAdministracion'),
  menu.indexOf('export const conTiendaDeAdministracion')
);

test('la tienda de administracion trae Tienda Virtual, Ordenes y Recibos, en ese orden', () => {
  const tienda = bloqueTienda.indexOf("title: 'Tienda Virtual'");
  const ordenes = bloqueTienda.indexOf("title: 'Órdenes'");
  const recibos = bloqueTienda.indexOf("title: 'Recibos'");

  assert.ok(tienda > 0 && ordenes > tienda && recibos > ordenes);
  assert.match(bloqueTienda, /path: paths\.dashboard\.order\.root/);
  assert.match(bloqueTienda, /path: paths\.dashboard\.invoice\.root/);
});

test('se colocan dentro del grupo "Tienda", en lugar del enlace directo', () => {
  assert.match(menu, /seccion\.subheader === 'Tienda'/);
  assert.match(
    menu,
    /item\.path === paths\.dashboard\.product\.root \? tiendaDeAdministracion : \[item\]/
  );
});

test('solo para el Administrador Global y el de Gestion de Tienda, y despues del filtro', () => {
  // Desde EVEREST Designer el resultado pasa por una entrada mas antes de
  // devolverse (`conTienda`), pero la condicion de la tienda es la misma.
  assert.match(
    layout,
    /const conTienda =\s*esAdministradorGlobal \|\| canManageStoreProducts\(user\)\s*\?\s*conTiendaDeAdministracion\(navDataFiltrada\)\s*:\s*navDataFiltrada;/
  );
  // Despues del filtro: puesta antes, el filtro podia convertirla en la de cliente.
  assert.ok(
    layout.indexOf('const navDataFiltrada = filterDashboardNavDataByUser(') <
      layout.indexOf('conTiendaDeAdministracion(navDataFiltrada)')
  );

  assert.equal(canManageStoreProducts({ rolId: 'administrador_tienda' }), true);
  assert.equal(canManageStoreProducts({ rolId: 'usuario_destacamento' }), false);
});

test('el resto de los miembros sigue con el desplegable de cliente', () => {
  const menuTienda = [
    {
      subheader: 'Tienda',
      items: [
        { title: 'Tienda Virtual', path: '/dashboard/product', deepMatch: true },
        { title: 'Mi carrito', path: '/dashboard/checkout' },
      ],
    },
  ];
  const coordinador = { role: 'administrador', rolId: 'usuario_destacamento', idMiembros: 5 };

  const [tienda] = filterDashboardNavDataByUser(menuTienda, coordinador);
  const tiendaVirtual = tienda.items.find((item) => item.title === 'Tienda Virtual');

  assert.deepEqual(
    tiendaVirtual.children.map((item) => item.title),
    ['Lista de productos', 'Mis ordenes', 'Mis recibos']
  );
});

test('Ordenes y Recibos no se repiten en el grupo de Desarrollo', () => {
  const desarrollo = menu.slice(menu.indexOf('export const navDataDesarrollo'));

  assert.doesNotMatch(desarrollo, /title: 'Ordenes - DEV'/);
  assert.doesNotMatch(desarrollo, /title: 'Recibos - DEV'/);
  assert.doesNotMatch(desarrollo, /title: 'Tienda - DEV'/);
});
