import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// SOLICITAR UN PRODUCTO AGOTADO.
//
// Con el inventario en 0, "Comprar ahora" quedaba gris y la persona se iba sin
// poder decir que lo necesitaba. Ahora dice "Solicitar producto": deja una orden
// SOLICITADA, avisa a la Tienda Virtual, a la Oficina Nacional y al
// Administrador Global, y quien la atiende la encuentra en "Solicitados".
//
// Lo que no puede pasar: que una solicitud descuente inventario o genere recibo
// —no es una compra— ni que cancelarla devuelva existencias que nunca salieron.

const {
  ESTADO_SOLICITADA,
  ESTADO_UI_SOLICITADO,
  productoAgotado,
  perfilAtiendeSolicitudes,
  AVISO_SOLICITUD_ENVIADA,
} = await import('src/utils/solicitud-producto.mjs');
const { atiendeSolicitudesDeTienda, filterDashboardNavDataByUser } =
  await import('src/utils/member-access.js');
const { mapearOrdenFirestoreAUi, mapearEstadoOrdenUiAFirestore } =
  await import('src/models/order-model.js');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('un producto sin existencias esta agotado; con una sola, no', () => {
  assert.equal(productoAgotado({ available: 0 }), true);
  assert.equal(productoAgotado({ available: '0' }), true);
  assert.equal(productoAgotado({}), true);
  assert.equal(productoAgotado({ available: -2 }), true);
  assert.equal(productoAgotado({ available: 1 }), false);
  assert.equal(productoAgotado({ disponibles: 5 }), false);
});

test('la orden solicitada va y vuelve de Firestore con su propio estado', () => {
  assert.equal(mapearEstadoOrdenUiAFirestore(ESTADO_UI_SOLICITADO), ESTADO_SOLICITADA);

  const orden = mapearOrdenFirestoreAUi({ ordenId: 'orden-1', estado: 'solicitada', items: [] });

  assert.equal(orden.status, 'requested');
  assert.equal(orden.esSolicitud, true);
  // Una pendiente de siempre sigue siendo pendiente.
  assert.equal(mapearOrdenFirestoreAUi({ estado: 'pendiente' }).status, 'pending');
  assert.equal(mapearOrdenFirestoreAUi({ estado: 'pendiente' }).esSolicitud, false);
});

test('atienden las solicitudes Tienda Virtual, Oficina Nacional y el Administrador Global', () => {
  assert.equal(atiendeSolicitudesDeTienda({ rolId: 'administrador_global' }), true);
  assert.equal(atiendeSolicitudesDeTienda({ rolId: 'administrador_tienda' }), true);
  assert.equal(atiendeSolicitudesDeTienda({ rolId: 'oficina_nacional' }), true);
  assert.equal(atiendeSolicitudesDeTienda({ rolId: 'usuario_destacamento' }), false);
  assert.equal(atiendeSolicitudesDeTienda({ rolId: 'administrador_funcional' }), false);

  // El aviso se reparte por los cargos del perfil de Firestore, todos ellos.
  assert.equal(perfilAtiendeSolicitudes(['usuario_destacamento', 'oficina_nacional']), true);
  assert.equal(perfilAtiendeSolicitudes(['Administrador_Tienda']), true);
  assert.equal(perfilAtiendeSolicitudes(['usuario_seccion']), false);
});

test('en el menu, quien atiende la tienda ve "Órdenes" y el resto "Mis ordenes"', () => {
  const menu = [
    { subheader: 'Tienda', items: [{ title: 'Tienda Virtual', path: '/dashboard/product' }] },
  ];
  const hijos = (usuario) =>
    filterDashboardNavDataByUser(menu, usuario)[0].items[0].children.map((item) => item.title);

  assert.deepEqual(hijos({ role: 'administrador', rolId: 'oficina_nacional' }), [
    'Lista de productos',
    'Órdenes',
    'Mis recibos',
  ]);
  assert.deepEqual(hijos({ role: 'administrador', rolId: 'usuario_destacamento' }), [
    'Lista de productos',
    'Mis ordenes',
    'Mis recibos',
  ]);
});

test('sin existencias el boton dice "Solicitar producto" y no se queda gris', () => {
  const resumen = leer('src/sections/product/product-details-summary.jsx');

  assert.match(resumen, /const isOutOfStock = productoAgotado\(\{ available \}\);/);
  assert.match(resumen, /isOutOfStock\s*\?\s*'Solicitar producto'/);
  assert.match(resumen, /disabled=\{\(disableActions && !isOutOfStock\) \|\|/);
  // La cantidad no queda atada a lo disponible, que es 0.
  assert.match(resumen, /max=\{isOutOfStock \? MAX_SOLICITUD : availableQuantity\}/);
  // Solicita y lleva al cierre del carrito.
  assert.match(
    resumen,
    /if \(isOutOfStock\) \{\s*const request = await onCreateProductRequest\?\.\(\{ item: itemToOrder \}\);/
  );
});

test('una solicitud no descuenta inventario, no genera recibo y no vacia el carrito', () => {
  const servicio = leer('src/services/order-service.js');
  const inicio = servicio.indexOf('export const crearSolicitudProductoFirestore');
  const fin = servicio.indexOf('export const listarOrdenesFirestore');
  const crearSolicitud = servicio.slice(inicio, fin);

  assert.ok(inicio > 0, 'falta crearSolicitudProductoFirestore');
  assert.doesNotMatch(crearSolicitud, /ajustarInventarioProducto/);
  assert.doesNotMatch(crearSolicitud, /guardarReciboFirestore/);
  assert.doesNotMatch(crearSolicitud, /limpiarCarritoUsuario\(/);
  assert.match(crearSolicitud, /estado: ESTADO_SOLICITADA/);
  assert.match(crearSolicitud, /esSolicitud: true/);
  assert.match(crearSolicitud, /crearNotificacionesSolicitudProducto/);
});

test('cancelar o reactivar una solicitud no mueve existencias', () => {
  const servicio = leer('src/services/order-service.js');

  assert.match(
    servicio,
    /const inventarioFueDescontado =\s*!ordenRequiereEvaluacion\(currentData\) &&\s*!currentData\?\.esSolicitud &&\s*currentStatus !== ESTADO_SOLICITADA;/
  );
});

test('el cierre del carrito enseña "Solicitado" y a quien se aviso, sin vaciar el carrito', () => {
  const cierre = leer('src/sections/checkout/checkout-order-complete.jsx');
  const vista = leer('src/sections/checkout/view/checkout-view.jsx');

  assert.equal(AVISO_SOLICITUD_ENVIADA, 'Se notificó a Tienda Virtual y Oficina Nacional.');
  assert.match(cierre, /'Producto solicitado'/);
  assert.match(cierre, /Solicitado\s*<\/Label>/);
  assert.match(cierre, /\{AVISO_SOLICITUD_ENVIADA\}/);
  assert.match(cierre, /onClick=\{requestInProcess \? undefined : onResetCart\}/);
  assert.match(vista, /requestInProcess=\{checkoutState\.order\?\.esSolicitud\}/);
});

test('la lista de ordenes: "Solicitados", "Órdenes" y su subtitulo, solo para quien atiende', () => {
  const nav = leer('src/sections/order/order-status-nav.jsx');
  const lista = leer('src/sections/order/view/order-list-view.jsx');

  assert.match(nav, /value: 'requested',\s*label: 'Solicitado',\s*apartado: 'Solicitados',/);
  assert.match(nav, /soloQuienAtiende: true/);
  assert.match(nav, /atiendeSolicitudes \? 'Órdenes' : 'Mis órdenes'/);
  assert.match(nav, /'Estados de los pedidos a Tienda Virtual\.'/);
  assert.match(nav, /estadosVisibles\(atiendeSolicitudes\)\.map/);
  assert.match(lista, /const atiendeSolicitudes = atiendeSolicitudesDeTienda\(user\);/);
});

test('debajo del total de una solicitud no sale "solicitud" como forma de pago', () => {
  // Se guarda `tipoPago: 'solicitud'` y la columna Total lo pintaba con el icono
  // de tarjeta, como si fuera un medio de pago. Una solicitud no se paga.
  const fila = leer('src/sections/order/order-table-row.jsx');
  const lista = leer('src/sections/order/view/order-list-view.jsx');

  assert.match(fila, /secondary=\{\s*row\.esSolicitud \? null : \(/);
  assert.match(lista, /row\.esSolicitud \? '' : metodoDePago\(row\.payment\)\.label/);
});

test('el aviso de la solicitud va a quien atiende, no a todos los administradores', () => {
  const avisos = leer('src/services/notification-service.js');
  const inicio = avisos.indexOf('export async function crearNotificacionesSolicitudProducto');
  const fin = avisos.indexOf('export async function crearNotificacionEvaluacionPedido');
  const solicitud = avisos.slice(inicio, fin);

  assert.ok(inicio > 0, 'falta crearNotificacionesSolicitudProducto');
  assert.match(solicitud, /await obtenerIdsQuienAtiendeSolicitudes\(\)/);
  assert.doesNotMatch(solicitud, /obtenerIdsAdministradoresNotificaciones/);
  assert.match(
    avisos,
    /perfilAtiendeSolicitudes\(cargosDelPerfil\(data\)\.map\(\(cargo\) => cargo\.rol\)\)/
  );
});
