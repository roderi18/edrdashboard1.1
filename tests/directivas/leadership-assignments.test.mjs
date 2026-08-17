import test from 'node:test';
import assert from 'node:assert/strict';

import {
  claveNodo,
  aMilisegundos,
  buscarPosicionPorNodo,
  resolverMiembroAsignado,
  construirResumenMiembro,
  indexarAsignacionesPorPosicion,
} from '../../src/utils/leadership-assignments.js';

// ----------------------------------------------------------------------
// Directivas de seccion, region y nacion.
//
// Regresion principal: al cambiar de ocupante se creaba un documento nuevo y el
// del anterior seguia activo, asi que la posicion quedaba con dos asignaciones y
// ganaba la que ordenara ultima por id de documento — el cambio se guardaba pero
// el organigrama seguia mostrando al miembro anterior.
// ----------------------------------------------------------------------

const POSICION = 'seccional-coordinador-produccion';

test('con dos asignaciones activas en la misma posicion gana la mas reciente', () => {
  const indice = indexarAsignacionesPorPosicion([
    { idPosicionDirectiva: POSICION, idMiembro: '4837', fechaActualizacion: { seconds: 100 } },
    { idPosicionDirectiva: POSICION, idMiembro: '1290', fechaActualizacion: { seconds: 200 } },
  ]);

  assert.equal(indice[POSICION].idMiembro, '1290');
});

test('el orden de llegada no altera el resultado', () => {
  const indice = indexarAsignacionesPorPosicion([
    { idPosicionDirectiva: POSICION, idMiembro: '1290', fechaActualizacion: { seconds: 200 } },
    { idPosicionDirectiva: POSICION, idMiembro: '4837', fechaActualizacion: { seconds: 100 } },
  ]);

  assert.equal(indice[POSICION].idMiembro, '1290');
});

test('cada posicion conserva su propio ocupante', () => {
  const indice = indexarAsignacionesPorPosicion([
    { idPosicionDirectiva: POSICION, idMiembro: '1290', fechaActualizacion: { seconds: 10 } },
    { idPosicionDirectiva: 'seccional-capellan', idMiembro: '77', fechaActualizacion: { seconds: 10 } },
  ]);

  assert.equal(Object.keys(indice).length, 2);
  assert.equal(indice['seccional-capellan'].idMiembro, '77');
});

test('las filas sin posicion se descartan', () => {
  assert.deepEqual(indexarAsignacionesPorPosicion([{ idMiembro: '1' }, {}]), {});
});

test('aMilisegundos entiende Timestamp, ISO y numero', () => {
  assert.equal(aMilisegundos({ seconds: 2 }), 2000);
  assert.equal(aMilisegundos({ toMillis: () => 5000 }), 5000);
  assert.equal(aMilisegundos('2026-08-17T00:00:00.000Z'), Date.parse('2026-08-17T00:00:00.000Z'));
  assert.equal(aMilisegundos(null), 0);
  assert.equal(aMilisegundos('no es una fecha'), 0);
});

// ----------------------------------------------------------------------

test('el nodo del diagrama casa con el cargo aunque difieran guiones y acentos', () => {
  const posiciones = [
    { nivel: 'regional', idCargo: 'regional-subdirector', idNodoDiagrama: 'sub-director-regional' },
    { nivel: 'seccional', idCargo: 'seccional-capellan', idNodoDiagrama: 'capellán-seccional' },
  ];

  assert.equal(
    buscarPosicionPorNodo(posiciones, 'regional', 'sub-director-regional').idCargo,
    'regional-subdirector'
  );
  assert.equal(
    buscarPosicionPorNodo(posiciones, 'seccional', 'capellan-seccional').idCargo,
    'seccional-capellan'
  );
});

test('un nodo de otro nivel no casa', () => {
  const posiciones = [{ nivel: 'regional', idCargo: 'regional-capellan', idNodoDiagrama: 'capellan' }];

  assert.equal(buscarPosicionPorNodo(posiciones, 'seccional', 'capellan'), null);
  assert.equal(buscarPosicionPorNodo(posiciones, 'regional', ''), null);
});

test('claveNodo normaliza acentos, mayusculas y separadores', () => {
  assert.equal(claveNodo('Capellán-Seccional'), 'capellanseccional');
  assert.equal(claveNodo('sub_director regional'), 'subdirectorregional');
});

// ----------------------------------------------------------------------

test('el ocupante se resuelve contra el listado de miembros', () => {
  const miembro = resolverMiembroAsignado({
    asignacion: { idMiembro: '4837' },
    members: [{ id: '4837', nombres: 'Oliver', apellidos: 'Feliz' }],
  });

  assert.equal(miembro.nombres, 'Oliver');
});

test('si el miembro no viene en el listado se usa la copia de la asignacion', () => {
  const miembro = resolverMiembroAsignado({
    asignacion: { idMiembro: '4837', nombreMiembro: 'Oliver Feliz', codigoMiembro: 'EX-1' },
    members: [],
  });

  assert.equal(miembro.name, 'Oliver Feliz');
  assert.equal(miembro.soloDesdeAsignacion, true);
});

test('un cargo sin ocupante devuelve null', () => {
  assert.equal(resolverMiembroAsignado({ asignacion: null, members: [] }), null);
  assert.equal(resolverMiembroAsignado({ asignacion: { idMiembro: '' }, members: [] }), null);
  // Sin copia guardada y sin ficha no hay a quien mostrar.
  assert.equal(resolverMiembroAsignado({ asignacion: { idMiembro: '9' }, members: [] }), null);
});

test('el resumen del miembro arma el nombre completo', () => {
  assert.deepEqual(
    construirResumenMiembro({ nombres: 'Oliver', apellidos: 'Feliz', codigoMiembro: 'EX-1' }),
    { nombreMiembro: 'Oliver Feliz', codigoMiembro: 'EX-1', fotoMiembro: '' }
  );
  assert.equal(construirResumenMiembro({}).nombreMiembro, '');
});
