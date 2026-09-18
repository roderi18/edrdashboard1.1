// ----------------------------------------------------------------------
// LAS PERILLAS DE LOS BRILLOS DE LAS CINTAS.
//
// Velocidad e intensidad del brillo del borde dorado y del número, como las de
// las medallas. Lo que no puede romperse: una cinta guardada antes de que
// existieran se ve igual (todas en 1 y no se escriben al guardar), un valor roto
// vuelve a 1 en vez de apagar o desbocar el brillo, y lo elegido se conserva al
// volver a guardar sin tocarlo.
// ----------------------------------------------------------------------

import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { AJUSTES_CINTA, normalizarAjusteCinta, configuracionPorCinta, construirCintasAsignadas } =
  await import('src/utils/cintas-perfil.mjs');

test('sin perillas guardadas, las cuatro valen 1', () => {
  const configuracion = configuracionPorCinta([{ id: '5', veces: 2 }]).get('5');

  Object.keys(AJUSTES_CINTA).forEach((clave) => assert.equal(configuracion[clave], 1, clave));
});

test('un valor fuera de rango, vacío o que no es número vuelve a 1', () => {
  assert.equal(normalizarAjusteCinta('velocidadBorde', 50), 1);
  assert.equal(normalizarAjusteCinta('intensidadNumero', 0), 1);
  assert.equal(normalizarAjusteCinta('intensidadBorde', ''), 1);
  assert.equal(normalizarAjusteCinta('velocidadNumero', 'rápido'), 1);
  assert.equal(normalizarAjusteCinta('clave-inventada', 2), 1);
  assert.equal(normalizarAjusteCinta('velocidadBorde', 1.456), 1.46);
});

test('al guardar, una cinta sin perillas no las escribe', () => {
  const [cinta] = construirCintasAsignadas([], [{ id: '3', veces: 1 }], 'ahora');

  Object.keys(AJUSTES_CINTA).forEach((clave) => assert.ok(!(clave in cinta), clave));
});

test('las perillas elegidas se guardan y se conservan al volver a guardar', () => {
  const primera = construirCintasAsignadas(
    [],
    [{ id: '5', veces: 1, velocidadBorde: 2, intensidadNumero: 0.5 }],
    'ahora'
  );

  assert.equal(primera[0].velocidadBorde, 2);
  assert.equal(primera[0].intensidadNumero, 0.5);

  const segunda = construirCintasAsignadas(primera, [{ id: '5', veces: 2 }], 'despues');

  assert.equal(segunda[0].velocidadBorde, 2);
  assert.equal(segunda[0].intensidadNumero, 0.5);
  assert.equal(configuracionPorCinta(segunda).get('5').velocidadBorde, 2);
});
