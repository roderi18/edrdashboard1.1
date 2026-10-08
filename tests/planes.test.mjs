import assert from 'node:assert/strict';
import test from 'node:test';

import { planesDisponibles } from '../src/server/planes.mjs';

test('sin licencia ni registro 2026 solo recibe RD$2500', () => {
  assert.deepEqual(planesDisponibles({ registrado2026: false, licenciaVigente: false }).map((p) => p.precio), [2500]);
});

test('registrado en 2026 sin licencia solo recibe RD$2250', () => {
  assert.deepEqual(planesDisponibles({ registrado2026: true, licenciaVigente: false }).map((p) => p.precio), [2250]);
});

test('licencia habilitada recibe RD$1500 y RD$2250', () => {
  assert.deepEqual(planesDisponibles({ registrado2026: false, licenciaVigente: true }).map((p) => p.precio), [1500, 2250]);
});

test('no se supone un beneficio con estado 2026 desconocido', () => {
  assert.deepEqual(planesDisponibles({ licenciaVigente: false }), []);
});

test('el desglose coincide con el total', () => {
  for (const plan of [
    ...planesDisponibles({ registrado2026: false, licenciaVigente: false }),
    ...planesDisponibles({ registrado2026: true, licenciaVigente: false }),
    ...planesDisponibles({ registrado2026: true, licenciaVigente: true }),
  ]) assert.equal(plan.cuotaRegistro + plan.rriTrac - plan.descuento, plan.precio);
});
