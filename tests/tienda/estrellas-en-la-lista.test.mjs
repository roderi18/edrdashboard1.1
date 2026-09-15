import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LAS ESTRELLAS DE LA LISTA SALEN DE LAS RESENAS REALES.
//
// "Emblema grande" tenia dos resenas (5 y 4): la ficha enseñaba 4,5 estrellas y
// "(2 reseñas)", y la tarjeta de la lista (0) y apagadas, porque leia el resumen
// guardado en el producto y ese resumen se habia quedado en 0.

const { resumirCalificaciones, agruparResumenPorProducto, aplicarResumenResenas } =
  await import('src/utils/resumen-resenas-producto.mjs');

test('la lista enseña las resenas reales aunque el producto diga 0', () => {
  const productos = [{ id: 'errd-001-emblema-grande', totalRatings: 0, totalReviews: 0 }];
  const resenas = [
    { id: 'a', productoId: 'errd-001-emblema-grande', calificacion: 5 },
    { id: 'b', productoId: 'errd-001-emblema-grande', calificacion: 4 },
  ];

  const [emblema] = aplicarResumenResenas(productos, agruparResumenPorProducto(resenas));

  assert.equal(emblema.totalReviews, 2);
  assert.equal(emblema.totalRatings, 4.5);
});

test('un producto sin resenas queda en 0 aunque su resumen guardado diga otra cosa', () => {
  const [producto] = aplicarResumenResenas(
    [{ id: 'p1', totalRatings: 3, totalReviews: 7 }],
    new Map()
  );

  assert.equal(producto.totalReviews, 0);
  assert.equal(producto.totalRatings, 0);
});

test('la media es la de la ficha: un decimal y cada calificacion entre 1 y 5', () => {
  assert.deepEqual(resumirCalificaciones([5, 4, 4]), { totalRatings: 4.3, totalReviews: 3 });
  assert.deepEqual(resumirCalificaciones([9, 0]), { totalRatings: 3, totalReviews: 2 });
});

test('una resena repetida cuenta una vez y las de otro producto no se mezclan', () => {
  const resumen = agruparResumenPorProducto([
    { id: 'a', productoId: 'p1', calificacion: 5 },
    { id: 'a', productoId: 'p1', calificacion: 5 },
    { id: 'b', productoId: 'p2', calificacion: 1 },
  ]);

  assert.deepEqual(resumen.get('p1'), { totalRatings: 5, totalReviews: 1 });
  assert.deepEqual(resumen.get('p2'), { totalRatings: 1, totalReviews: 1 });
});
