import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// UN PRODUCTO COMPARTIDO LLEGA AL CHAT COMO TARJETA.
//
// "Compartir" en la ficha del producto mandaba un texto con la URL pegada. Ahora
// el mensaje lleva `metadatos.sharedProduct` —nombre, imagen, precio y la ruta a
// la ficha— y el chat lo pinta como tarjeta que lleva al producto. Lo que no
// puede pasar: que por ese campo se cuele un enlace a cualquier sitio.

const { createChatMessageDocument, chatMessageToUi } =
  await import('src/server/chat-message-model.mjs');
const { tarjetaProductoCompartido } = await import('src/utils/producto-favorito-compartir.mjs');

const PRODUCTO = {
  id: 'errd-001-emblema-grande',
  name: 'Emblema grande',
  price: 200,
  coverUrl: 'https://firebasestorage.googleapis.com/v0/b/edr/o/emblema.webp',
};

const mensajeCon = (sharedProduct) =>
  createChatMessageDocument({
    message: {
      id: 'mensaje-1',
      body: 'Te comparto este producto de la Tienda Virtual: Emblema grande',
      senderId: 10,
      metadata: { sharedProduct },
    },
    conversationId: 'conversacion-1',
    now: '2026-09-15T12:00:00.000Z',
  });

test('la tarjeta viaja con nombre, precio, imagen y la ruta de la ficha', () => {
  const tarjeta = tarjetaProductoCompartido(PRODUCTO);
  const { metadata } = chatMessageToUi(mensajeCon(tarjeta));

  assert.deepEqual(metadata.sharedProduct, {
    id: 'errd-001-emblema-grande',
    name: 'Emblema grande',
    url: '/dashboard/product/errd-001-emblema-grande',
    price: 200,
    imageUrl: PRODUCTO.coverUrl,
  });
});

test('una ruta que no es la ficha de un producto no se guarda', () => {
  const tarjeta = { ...tarjetaProductoCompartido(PRODUCTO), url: 'https://otro-sitio.test/x' };

  assert.equal(mensajeCon(tarjeta).metadatos.sharedProduct, undefined);
});

test('una imagen que no es https se descarta, pero la tarjeta sigue', () => {
  const tarjeta = { ...tarjetaProductoCompartido(PRODUCTO), imageUrl: 'javascript:alert(1)' };
  const guardada = mensajeCon(tarjeta).metadatos.sharedProduct;

  assert.equal(guardada.name, 'Emblema grande');
  assert.equal(guardada.imageUrl, undefined);
});
