import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// FAVORITO Y COMPARTIR EN LA FICHA DEL PRODUCTO.
//
// Los dos enlaces estaban dibujados y no hacian nada. Ahora el favorito se
// guarda por persona en `favoritos_productos` y compartir envia el producto al
// chat de alguien. Lo que no puede pasar: que uno lea o cambie los favoritos de
// otro —el comodin de las reglas lo permitiria— ni que se comparta consigo mismo.

const {
  alternarFavorito,
  leerProductosFavoritos,
  mensajeCompartirProducto,
  destinatariosParaCompartir,
  COLECCION_FAVORITOS_PRODUCTOS,
} = await import('src/utils/producto-favorito-compartir.mjs');

const reglas = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');

test('pulsar el corazon marca el producto y pulsarlo otra vez lo quita', () => {
  const marcado = alternarFavorito(new Set(['p2']), 'p1');

  assert.deepEqual([...marcado].sort(), ['p1', 'p2']);
  assert.deepEqual([...alternarFavorito(marcado, 'p1')], ['p2']);
});

test('solo cuentan como favoritos los productos marcados en true', () => {
  const favoritos = leerProductosFavoritos({ productos: { a: true, b: false, c: 'si' } });

  assert.deepEqual([...favoritos], ['a']);
  assert.equal(leerProductosFavoritos({}).size, 0);
});

test('el mensaje compartido lleva el nombre y el enlace a la ficha', () => {
  const mensaje = mensajeCompartirProducto({
    nombre: 'Emblema grande',
    url: 'https://edr.test/product/errd-001-emblema-grande',
  });

  assert.match(mensaje, /Emblema grande/);
  assert.match(mensaje, /\nhttps:\/\/edr\.test\/product\/errd-001-emblema-grande$/);
});

test('en el desplegable de compartir no sale uno mismo', () => {
  const contactos = [
    { id: '10', idMiembros: 10, name: 'Yo' },
    { id: '11', idMiembros: 11, name: 'Ana' },
    { id: '20001', idMiembros: 20001, name: 'Tienda Virtual' },
  ];

  const nombres = destinatariosParaCompartir(contactos, { id: '10', idMiembros: 10 }).map(
    (contacto) => contacto.name
  );

  assert.deepEqual(nombres, ['Ana', 'Tienda Virtual']);
});

test('las reglas dejan a cada uno solo sus favoritos y el comodin no los abre', () => {
  assert.equal(COLECCION_FAVORITOS_PRODUCTOS, 'favoritos_productos');

  const bloque = reglas.match(/match \/favoritos_productos\/\{uid\} \{([\s\S]*?)\n    \}/);

  assert.ok(bloque, 'falta el bloque de favoritos_productos en firestore.rules');
  assert.match(bloque[1], /allow get: if estaAutenticado\(\) && request\.auth\.uid == uid;/);
  assert.match(bloque[1], /allow list: if false;/);
  assert.match(bloque[1], /request\.resource\.data\.uid == uid/);
  assert.match(reglas, /&& coleccion != 'favoritos_productos'/);
});
