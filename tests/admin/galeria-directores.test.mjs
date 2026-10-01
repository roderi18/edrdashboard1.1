// La Galería de Directores Nacionales se pide ordenada del año más reciente al
// más antiguo (los menores debajo). Ordenar por el texto ponía "1998" delante
// de "2008-2010", y una placa con {nombre} salía con las llaves a la vista.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  conTextos,
  anioDeOrden,
  ordenarGaleria,
  validarDirectorNuevo,
  directorDesdeDocumento,
} from '../../src/utils/galeria-directores.mjs';

test('de mayor a menor por el año de inicio; los menores quedan debajo', () => {
  const orden = ordenarGaleria([
    { nombre: 'A', anio: '1998-2002' },
    { nombre: 'B', anio: '2008-2010' },
    { nombre: 'C', anio: '2022' },
    { nombre: 'D', anio: '2008-2012' },
  ]).map((d) => d.nombre);
  assert.deepEqual(orden, ['C', 'D', 'B', 'A']);
});

test('el año que ordena es el primero de cuatro cifras', () => {
  assert.equal(anioDeOrden('2008-2010'), 2008);
  assert.equal(anioDeOrden('sin año'), 0);
});

test('nombre, año y foto son obligatorios', () => {
  assert.ok(validarDirectorNuevo({ nombre: '', anio: '2008', tieneFoto: true }));
  assert.ok(validarDirectorNuevo({ nombre: 'X', anio: '08', tieneFoto: true }));
  assert.ok(validarDirectorNuevo({ nombre: 'X', anio: '2008', tieneFoto: false }));
  assert.equal(validarDirectorNuevo({ nombre: 'X', anio: '2008', tieneFoto: true }), '');
});

test('sin foto https o sin nombre no se pinta', () => {
  assert.equal(directorDesdeDocumento('a', { nombre: 'X', fotoUrl: 'data:x' }), null);
  assert.equal(directorDesdeDocumento('a', { nombre: ' ', fotoUrl: 'https://x' }), null);
  assert.deepEqual(
    directorDesdeDocumento('a', { nombre: 'X', anio: '2008', fotoUrl: 'https://x' }),
    {
      id: 'a',
      nombre: 'X',
      anio: '2008',
      fotoUrl: 'https://x',
    }
  );
});

test('la placa cambia {nombre} y {año} por los del director', () => {
  const textos = { nombre: 'Mirke de León', anio: '2008-2010' };
  assert.equal(conTextos('{nombre}', textos), 'Mirke de León');
  assert.equal(conTextos('{año}', textos), '2008-2010');
  assert.equal(conTextos('{nombre}', undefined), '{nombre}');
});
