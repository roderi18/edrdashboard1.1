// "CERTIFICADOS CREADOS": LOTES Y ONERRD JUNTOS, CON FILTROS Y EL CÓDIGO DE
// QUIEN LOS CREÓ.
//
// Qué protege: la lista junta los lotes de "Crear certificados" y los
// certificados ONERRD, y se filtra por lote, certificado, fecha y creado por.
// Debajo del nombre de quien lo creó va su código, salvo si es "Sistema".
// Las fechas se cortan en hora de Santo Domingo: un lote de las 9 p. m. del
// día 3 no puede salir como del día 4.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filaDeLote,
  esCreadorSistema,
  hayFiltrosCreados,
  filaDeEmitidoOnerrd,
  FILTROS_CREADOS_VACIOS,
  opcionesDeFiltroCreados,
  unirCertificadosCreados,
  TITULO_CERTIFICADO_ONERRD,
  filtrarCertificadosCreados,
} from '../../src/utils/certificados-creados.mjs';

const lote = {
  id: 'CERT-20261003-110624',
  course: { certificateTitle: 'ESCALON SEGURIDAD', name: 'ESCALON SEGURIDAD' },
  templateName: 'ESCALON SEGURIDAD',
  totalCertificates: 2,
  createdAt: '2026-10-03T15:06:00Z',
  createdBy: { uid: 'u1', name: 'Roderi Daniel Peña Rosario', code: '12345' },
};

const emitido = {
  numeroRegistro: '2027-009',
  valores: { numeroDestacamento: '11', nombreDestacamento: 'Centinelas' },
  emitidoEnIso: '2026-10-07T13:49:00Z',
  emitidoPor: { uid: 'u2', nombre: 'Ana Ruiz', codigo: '777' },
};

test('lotes y certificados ONERRD salen juntos, del más nuevo al más viejo', () => {
  const filas = unirCertificadosCreados([lote], [emitido]);
  assert.deepEqual(
    filas.map((f) => [f.tipo, f.id]),
    [
      ['onerrd', '2027-009'],
      ['curso', 'CERT-20261003-110624'],
    ]
  );
  assert.equal(filas[0].titulo, TITULO_CERTIFICADO_ONERRD);
  assert.equal(filas[0].detalle, 'Dest. 11 · Centinelas');
  assert.equal(filas[0].cantidad, 1);
  assert.equal(filas[1].cantidad, 2);
});

test('debajo de quien lo creó va su código; si es "Sistema", nada', () => {
  assert.deepEqual(filaDeLote(lote).creador, {
    uid: 'u1',
    nombre: 'Roderi Daniel Peña Rosario',
    codigo: '12345',
  });
  assert.equal(filaDeEmitidoOnerrd(emitido).creador.codigo, '777');
  assert.equal(
    filaDeLote({ ...lote, createdBy: { name: 'Sistema', code: '1' } }).creador.codigo,
    ''
  );
  assert.equal(filaDeLote({ ...lote, createdBy: 'Roderi Pena' }).creador.nombre, 'Roderi Pena');
  assert.equal(esCreadorSistema(' sistema '), true);
});

test('se filtra por lote, certificado, fecha y creado por', () => {
  const filas = unirCertificadosCreados(
    [lote, { ...lote, id: 'CERT-20260517-201526', createdAt: '2026-05-18T00:15:00Z' }],
    [emitido]
  );
  const filtrar = (filtros) =>
    filtrarCertificadosCreados(filas, { ...FILTROS_CREADOS_VACIOS, ...filtros }).map((f) => f.id);

  assert.deepEqual(filtrar({ lote: '20261003' }), ['CERT-20261003-110624']);
  // El lote ONERRD también se encuentra por su destacamento.
  assert.deepEqual(filtrar({ lote: 'centinelas' }), ['2027-009']);
  assert.deepEqual(filtrar({ certificado: TITULO_CERTIFICADO_ONERRD }), ['2027-009']);
  assert.deepEqual(filtrar({ creadoPor: 'Ana Ruiz' }), ['2027-009']);
  // 00:15 UTC del 18 de mayo son las 8:15 p. m. del 17 en Santo Domingo.
  assert.deepEqual(filtrar({ desde: '2026-05-17', hasta: '2026-05-17' }), ['CERT-20260517-201526']);
  assert.deepEqual(filtrar({ desde: '2026-10-04' }), ['2027-009']);
  assert.equal(filtrar({}).length, 3);
  assert.equal(hayFiltrosCreados(FILTROS_CREADOS_VACIOS), false);
  assert.equal(hayFiltrosCreados({ lote: 'x' }), true);
});

test('los desplegables ofrecen solo lo que hay, sin repetir', () => {
  const opciones = opcionesDeFiltroCreados(unirCertificadosCreados([lote, lote], [emitido]));
  assert.deepEqual(opciones.certificados, ['Certificado de Registro ONERRD', 'ESCALON SEGURIDAD']);
  assert.deepEqual(opciones.creadores, ['Ana Ruiz', 'Roderi Daniel Peña Rosario']);
});
