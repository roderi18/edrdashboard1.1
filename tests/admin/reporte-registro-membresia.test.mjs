import assert from 'node:assert/strict';
import test from 'node:test';

import { filasReporteRegistro } from '../../src/utils/reporte-registro-membresia.mjs';

test('el reporte toma Registrado por y no el coordinador del destacamento', () => {
  const [fila] = filasReporteRegistro([
    {
      id: '231',
      estado: 'confirmada',
      codigo: 'ONERRD 2027-0003',
      creadoEn: '2026-10-09T12:00:00Z',
      destacamento: {
        numero: '18',
        region: 'Región Central',
        coordinador: 'Arsenio Leyba',
      },
      registradoPor: { nombre: 'Roderi Daniel Peña Rosario' },
    },
  ]);
  assert.equal(fila.registradoPor, 'Roderi Daniel Peña Rosario');
  assert.notEqual(fila.registradoPor, 'Arsenio Leyba');
  assert.equal(fila.registro, '003');
});

test('el reporte agrega RA cuando el destacamento estaba inactivo al registrarse', () => {
  const [fila] = filasReporteRegistro(
    [
      {
        id: '231',
        estado: 'confirmada',
        codigo: 'ONERRD 2027-0003',
        destacamento: { numero: '18', region: 'Central' },
      },
    ],
    [{ id: '231', estado: 'inactivo' }]
  );
  assert.equal(fila.registro, '003RA');
});

test('el estado guardado al pagar prevalece sobre cambios posteriores del padrón', () => {
  const [fila] = filasReporteRegistro(
    [
      {
        id: '231',
        estado: 'confirmada',
        certificadoEmitido: { numeroRegistro: '2027-023' },
        destacamento: { numero: '18', region: 'Central', estado: 'inactivo' },
      },
    ],
    [{ id: '231', estado: 'registrado' }]
  );
  assert.equal(fila.registro, '023RA');
});
