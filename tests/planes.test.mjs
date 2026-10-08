// Las tarifas 2027 las decide la configuración del dashboard; aquí se prueba
// la copia que usa la landing y los montos con coma de miles. Se rompía: con
// licencia se ofrecía una tarifa de RD$2,250 aunque no estuviera registrado en
// 2026, y sin saber el registro 2026 se habría supuesto un precio.
import assert from 'node:assert/strict';
import test from 'node:test';

import { aDolares, formatearRd } from '../src/utils/planes-membresia.mjs';
import {
  tieneLicencia,
  planesDisponibles,
  sanearConfiguracionMembresia,
} from '../src/utils/configuracion-membresia.mjs';

const fabrica = sanearConfiguracionMembresia({});
const precios = (entrada, config = fabrica) =>
  planesDisponibles(entrada, config).map((p) => p.precio);

test('no registrado en 2026 y sin licencia: solo RD$2,500', () => {
  assert.deepEqual(precios({ registrado2026: false, licenciaVigente: false }), [2500]);
});

test('registrado en 2026 y sin licencia: solo RD$2,250', () => {
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: false }), [2250]);
});

test('con licencia: RD$1,500 o su tarifa con RRI TRaC', () => {
  assert.deepEqual(precios({ registrado2026: true, licenciaVigente: true }), [1500, 2250]);
  assert.deepEqual(precios({ registrado2026: false, licenciaVigente: true }), [1500, 2500]);
});

test('registro 2026 desconocido: no se supone ningún precio con RRI TRaC', () => {
  assert.deepEqual(precios({ registrado2026: null, licenciaVigente: false }), []);
  assert.deepEqual(precios({ registrado2026: null, licenciaVigente: true }), [1500]);
});

test('lo que cambia el dashboard cambia el precio', () => {
  const config = sanearConfiguracionMembresia({ cuotaRegistro: 1800, licencias: ['97'] });
  assert.deepEqual(
    precios({ registrado2026: true, licenciaVigente: tieneLicencia(config, '097') }, config),
    [1800, 2550]
  );
});

test('montos con coma de miles y equivalente en dólares', () => {
  assert.equal(formatearRd(2250), 'RD$2,250');
  assert.equal(formatearRd(2250, { decimales: true }), 'RD$2,250.00');
  assert.equal(aDolares(2500, 62.5), 40);
  assert.equal(aDolares(2500, 0), null);
});
