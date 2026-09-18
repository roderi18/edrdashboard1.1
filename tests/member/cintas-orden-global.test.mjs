// ----------------------------------------------------------------------
// EL ORDEN GLOBAL DE LAS CINTAS MANDA EN TODOS LOS PERFILES.
//
// Qué se pidió: en EXPLORA Designer se arrastran las cintas y ese lugar es su
// posición en todas partes, en los perfiles que ya las tienen y al asignarlas.
// Qué no se puede romper: sin orden guardado, todo sigue con el número del
// archivo (el manual), y un orden guardado viejo o incompleto nunca pierde una
// cinta ni pinta una que ya no existe.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ordenarCintas,
  catalogoEnOrden,
  esOrdenDeFabrica,
  moverCintaEnOrden,
  normalizarOrdenGlobal,
  disponerCintasEnFilas,
  CATALOGO_CINTAS_PERFIL,
} from '../../src/utils/cintas-perfil.mjs';

const fabrica = CATALOGO_CINTAS_PERFIL.map((cinta) => cinta.id);

test('sin orden guardado, manda el número del archivo como siempre', () => {
  assert.deepEqual(ordenarCintas(['14', '2', '3'], null), ['2', '3', '14']);
  assert.deepEqual(normalizarOrdenGlobal([]), fabrica);
  assert.equal(esOrdenDeFabrica([]), true);
});

test('el orden guardado manda en las cintas ya asignadas y en sus filas', () => {
  const orden = ['25', '14', '3'];

  assert.deepEqual(ordenarCintas(['3', '14', '25'], orden), ['25', '14', '3']);
  assert.deepEqual(disponerCintasEnFilas(['3', '14', '25', '8'], { orden }), [
    ['25'],
    ['14', '3', '8'],
  ]);
});

test('un orden viejo o roto no pierde cintas ni pinta las que no existen', () => {
  const orden = normalizarOrdenGlobal(['40', '40', '9', 'x', '1']);

  assert.deepEqual(orden.slice(0, 2), ['40', '1']);
  assert.equal(orden.length, fabrica.length);
  assert.deepEqual([...orden].sort(), [...fabrica].sort());
});

test('arrastrar una cinta sobre otra la pone en su lugar', () => {
  const movido = moverCintaEnOrden([], '3', '1');

  assert.deepEqual(movido.slice(0, 3), ['3', '1', '2']);
  assert.deepEqual(moverCintaEnOrden(movido, '3', '2').slice(0, 3), ['1', '2', '3']);
  assert.deepEqual(catalogoEnOrden(movido)[0].id, '3');
});

test('el orden solo lo escribe el Administrador Global y no cae en el comodín', async () => {
  const reglas = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');

  assert.match(
    reglas,
    /match \/configuracion_cintas\/\{documento\} \{\s*allow read: if esUsuarioDelSistema\(\);\s*allow write: if esAdministradorGlobal\(\);/
  );
  assert.match(reglas, /coleccion != 'configuracion_cintas'/);
});

test('el perfil y el diálogo de asignar usan el orden global', async () => {
  const perfil = await readFile(
    new URL('../../src/components/insignias-perfil/cintas-de-miembro.jsx', import.meta.url),
    'utf8'
  );

  assert.match(perfil, /disponerCintasEnFilas\(asignadas, \{ orden \}\)/);
  assert.match(perfil, /catalogoEnOrden\(orden\)/);
});
