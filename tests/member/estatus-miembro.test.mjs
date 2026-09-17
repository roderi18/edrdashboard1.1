// ----------------------------------------------------------------------
// EL ESTATUS DEL MIEMBRO TIENE CUATRO VALORES Y LOS DE SIEMPRE NO CAMBIAN.
//
// Solo existían "Activo" e "Inactivo": no se distinguía a quien empezaba a
// faltar de quien llevaba meses sin venir o había fallecido. Lo ya guardado
// ('active', 'banned', 'activo', 'inactivo') debe seguir leyéndose igual.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const {
  ESTATUS_MIEMBRO,
  OPCIONES_ESTATUS_MIEMBRO,
  normalizarEstatusMiembro,
  opcionEstatusMiembro,
} = await import('src/utils/estatus-miembro.mjs');

test('hay cuatro estatus, en este orden y con su explicación', () => {
  assert.deepEqual(
    OPCIONES_ESTATUS_MIEMBRO.map((opcion) => opcion.label),
    ['Activo', 'Necesita reclutamiento', 'Inactivo', 'Fallecido']
  );
  OPCIONES_ESTATUS_MIEMBRO.forEach((opcion) => assert.ok(opcion.descripcion, opcion.label));
});

test('el chip dice "Reclutamiento" y cada estatus tiene su color', () => {
  assert.deepEqual(
    OPCIONES_ESTATUS_MIEMBRO.map((opcion) => [opcion.etiqueta, opcion.color]),
    [
      ['Activo', 'success'],
      ['Reclutamiento', 'warning'],
      ['Inactivo', 'error'],
      ['Fallecido', 'default'],
    ]
  );
});

test('los valores ya guardados se siguen leyendo igual', () => {
  assert.equal(normalizarEstatusMiembro('active'), ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(normalizarEstatusMiembro('Activo'), ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(normalizarEstatusMiembro('banned'), 'banned');
  assert.equal(normalizarEstatusMiembro('inactivo'), ESTATUS_MIEMBRO.INACTIVO);
  assert.equal(normalizarEstatusMiembro(''), ESTATUS_MIEMBRO.ACTIVO);
  assert.equal(normalizarEstatusMiembro(null), ESTATUS_MIEMBRO.ACTIVO);
});

test('los estatus nuevos se reconocen', () => {
  assert.equal(normalizarEstatusMiembro('reclutamiento'), ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO);
  assert.equal(normalizarEstatusMiembro('Fallecido'), ESTATUS_MIEMBRO.FALLECIDO);
  assert.match(opcionEstatusMiembro('reclutamiento').descripcion, /3 reuniones/);
  assert.match(opcionEstatusMiembro('inactivo').descripcion, /tres meses/);
});
