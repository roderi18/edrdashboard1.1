import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ORD-26-0148: correlativo por año, y NUNCA repetido.
//
// Antes el numero era el reloj —"ORD-1777776824429"—: diecisiete caracteres que
// ni se dicen por telefono ni cuentan cuantos pedidos van.

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const { formatearNumeroDeOrden } = await import('../../src/services/order-number-service.js');

test('el numero se lee ORD-26-0148', () => {
  assert.equal(formatearNumeroDeOrden(2026, 148), 'ORD-26-0148');
  assert.equal(formatearNumeroDeOrden(2026, 1), 'ORD-26-0001');
  assert.equal(formatearNumeroDeOrden(2027, 9999), 'ORD-27-9999');
});

test('pasado el diez mil crece, no vuelve a empezar ni se recorta', () => {
  assert.equal(formatearNumeroDeOrden(2026, 10000), 'ORD-26-10000');
  assert.equal(formatearNumeroDeOrden(2026, 123456), 'ORD-26-123456');
});

test('lo que impide repetirlo es la transaccion, no el formato', () => {
  const servicio = leer('src/services/order-number-service.js');

  assert.match(servicio, /await runTransaction\(FIRESTORE, async \(transaccion\) => \{/);
  assert.match(servicio, /const instantanea = await transaccion\.get\(referencia\);/);
  assert.match(servicio, /const siguiente = ultimo \+ 1;/);
  // Un documento por año: 2026 y 2027 no se estorban.
  assert.match(servicio, /`recibos-\$\{anio\}`/);
});

test('el pedido no se escribe si no consiguio numero', () => {
  const ordenes = leer('src/services/order-service.js');
  const modelo = leer('src/models/order-model.js');

  assert.match(ordenes, /const numeroOrden = await siguienteNumeroDeOrden\(\);/);
  assert.match(ordenes, /numeroOrden,/);
  // El modelo ya no se lo inventa.
  assert.doesNotMatch(modelo, /numeroOrden: `ORD-\$\{Date\.now\(\)\}`/);
  assert.match(modelo, /^ {4}numeroOrden,$/m);
});

test('el chat enlaza las tres formas que conviven', () => {
  const chat = leer('src/sections/chat/chat-message-item.jsx');
  const patron = /const NUMERO_DE_ORDEN = String\.raw`([^`]+)`;/.exec(chat);

  assert.ok(patron, 'no se encontro el patron de numeros de orden');

  const exacto = new RegExp(`^(?:${patron[1]})$`);
  const enTexto = new RegExp(`(${patron[1]})`, 'g');

  // Las nuevas, las pocas que salieron con REC y las antiguas.
  ['ORD-26-0148', 'REC-26-0001', 'ORD-1777776824429'].forEach((numero) => {
    assert.match(numero, exacto, `${numero} deberia reconocerse`);
  });

  // LA FORMA LARGA PRIMERO: con "ORD-\d+" delante, de "ORD-26-0148" solo se
  // llevaria el "ORD-26" y el enlace apuntaria a un pedido que no existe.
  assert.deepEqual('Pagué el ORD-26-0148 ayer'.match(enTexto), ['ORD-26-0148']);
});

test('bajo el nombre va el codigo del usuario, nunca el uid de Firebase', () => {
  const fila = leer('src/sections/order/order-table-row.jsx');

  assert.match(fila, /row\.customer\.codigoMiembro \|\|/);
  assert.doesNotMatch(fila, /row\.customer\.id \|\|/);
  assert.match(fila, /'Sin código'/);
});

test('el recibo lleva el numero de su pedido: una compra, un numero', () => {
  const modelo = leer('src/models/receipt-model.js');
  const servicioRecibos = leer('src/services/receipt-service.js');
  const servicioOrdenes = leer('src/services/order-service.js');

  assert.match(modelo, /numeroRecibo: normalizeText\(numeroOrden\) \|\| buildReceiptNumber\(\{ createdAt \}\)/);
  assert.match(servicioRecibos, /numeroOrden,/);
  assert.match(servicioOrdenes, /guardarReciboFirestore\(\{\s*\n\s*user,\s*\n\s*receiptId,\s*\n\s*orderId,\s*\n\s*numeroOrden,/);
});

test('un numero ya escrito no se vuelve a inventar al pintarlo', () => {
  const modelo = leer('src/models/receipt-model.js');

  // Aceptaba solo los que empezaban por "REC-": en cuanto el recibo paso a
  // llevar "ORD-26-0001" lo tiraba y pintaba uno nuevo por fecha.
  assert.doesNotMatch(modelo, /currentNumber && currentNumber\.startsWith\('REC-'\)/);
  assert.match(modelo, /if \(currentNumber\) \{\s*\n\s*return currentNumber;/);
});

test('volver a guardar un recibo no le mueve la fecha de emision', () => {
  const modelo = leer('src/models/receipt-model.js');
  const servicio = leer('src/services/receipt-service.js');

  // El servicio ya leia la fecha anterior; el modelo no la recogia.
  assert.match(servicio, /fechaCreacion: previous\.exists\(\) \? previous\.data\(\)\?\.fechaCreacion : null/);
  assert.match(modelo, /fechaCreacion = null,/);
  assert.match(modelo, /const createdAt = fechaCreacion \?\? ahoraTimestamp\(\);/);
});
