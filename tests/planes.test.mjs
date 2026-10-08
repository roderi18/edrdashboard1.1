// Las tarifas 2027 de la Oficina Nacional. Se rompía: con licencia se ofrecía
// una tarifa "licencia + RRI TRaC" de RD$2,250 aunque no estuviera registrado
// en 2026, y sin saber el registro 2026 se habría supuesto un precio.
import assert from 'node:assert/strict';
import test from 'node:test';

import { aDolares, formatearRd, planesDisponibles } from '../src/utils/planes-membresia.mjs';

const precios = (entrada) => planesDisponibles(entrada).map((p) => p.precio);

test('no registrado en 2026 y sin licencia: solo RD$2,500', () => {
  assert.deepEqual(precios({ registrado2026: false, licenciaVigente: false }), [2500]);
});

test('registrado en 2026 y sin licencia: solo RD$2,250', () => {
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: false }), [2250]);
});

test('con licencia y registrado en 2026: RD$1,500 o RD$2,250', () => {
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: true }), [1500, 2250]);
});

test('con licencia aunque no se registrara en 2026: RD$1,500 o RD$2,500', () => {
  assert.deepEqual(precios({ registrado2026: false, licenciaVigente: true }), [1500, 2500]);
});

test('registro 2026 desconocido: no se supone ningún precio con RRI TRaC', () => {
  assert.deepEqual(precios({ registrado2026: null, licenciaVigente: false }), []);
  assert.deepEqual(precios({ registrado2026: null, licenciaVigente: true }), [1500]);
});

test('el desglose de cada plan cuadra con su total', () => {
  for (const plan of [
    ...planesDisponibles({ registrado2026: false, licenciaVigente: true }),
    ...planesDisponibles({ registrado2026: true, licenciaVigente: false }),
  ]) {
    assert.equal(plan.cuotaRegistro + plan.rriTrac - plan.descuento, plan.precio);
  }
});

test('montos con coma de miles y equivalente en dólares', () => {
  assert.equal(formatearRd(2250), 'RD$2,250');
  assert.equal(formatearRd(2250, { decimales: true }), 'RD$2,250.00');
  assert.equal(aDolares(2500, 62.5), 40);
  assert.equal(aDolares(2500, 0), null);
});
