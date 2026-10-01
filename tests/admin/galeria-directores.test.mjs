// La Galería de Directores Nacionales se pide ordenada del año más reciente al
// más antiguo (los menores debajo). Ordenar por el texto ponía "1998" delante
// de "2008-2010", y una placa con {nombre} salía con las llaves a la vista.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  conTextos,
  anioDeOrden,
  periodosDe,
  textoDePlaca,
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
      placaArriba: '',
      placaAbajo: '',
    }
  );
});

test('la placa cambia {nombre} y {año} por los del director', () => {
  const textos = { nombre: 'Mirke de León', anio: '2008-2010' };
  assert.equal(conTextos('{nombre}', textos), 'Mirke de León');
  assert.equal(conTextos('{año}', textos), '2008-2010');
  assert.equal(conTextos('{nombre}', undefined), '{nombre}');
});

// Hay directores que sirvieron dos veces ("2010-2014 / 2018-2022", como en su
// placa). Antes el texto se cortaba a 30 caracteres y se ordenaba solo por el
// primer periodo.
test('dos periodos: se leen los dos y manda el más reciente', () => {
  assert.deepEqual(periodosDe('2010-2014 / 2018-2022'), [
    { inicio: 2010, fin: 2014 },
    { inicio: 2018, fin: 2022 },
  ]);
  assert.equal(anioDeOrden('2010-2014 / 2018-2022'), 2018);

  const orden = ordenarGaleria([
    { nombre: 'Uno', anio: '2014-2018' },
    { nombre: 'Dany', anio: '2010-2014 / 2018-2022' },
    { nombre: 'Tres', anio: '2022-2026' },
  ]).map((d) => d.nombre);
  assert.deepEqual(orden, ['Tres', 'Dany', 'Uno']);
});

test('el texto largo de dos periodos no se corta', () => {
  const anio = 'Ex Director Nacional 2010-2014 / 2018-2022';
  assert.equal(directorDesdeDocumento('a', { nombre: 'X', anio, fotoUrl: 'https://x' }).anio, anio);
});

// El texto de la barra dorada escrito en el Designer salía en TODAS las
// tarjetas ("Dany Trinidad Feliz" en la de Alejandro Terrero). Cada director
// lleva el suyo, y vacío vale su nombre y su año.
test('la barra dorada es de cada director; vacía, su nombre y su año', () => {
  assert.deepEqual(textoDePlaca({ nombre: 'Alejandro Terrero', anio: '2022-2026' }), {
    arriba: 'Alejandro Terrero',
    abajo: '2022-2026',
  });
  assert.deepEqual(
    textoDePlaca({
      nombre: 'Rev. Dany Trinidad Feliz',
      anio: 'Ex Director Nacional 2010-2014',
      placaArriba: 'Dany Trinidad Feliz',
      placaAbajo: '2010-2014 / 2018-2022',
    }),
    { arriba: 'Dany Trinidad Feliz', abajo: '2010-2014 / 2018-2022' }
  );
});
