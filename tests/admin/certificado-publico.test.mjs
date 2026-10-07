// EL QR DE LOS CERTIFICADOS DE "CREAR CERTIFICADOS" ABRE SU CONTENEDOR.
//
// Qué protege: el QR de esos certificados llevaba la URL directa del PDF en
// Storage; ahora abre la misma página que el ONERRD (qué certificado es, a
// quién y cuándo se generó, con el PDF dentro). Cada certificado lleva su
// propia clave: el id es predecible (lote con fecha y hora + código del
// miembro) y, sin clave, cualquiera podría ir probando. Los dos tipos de
// certificado comparten la clave, su formato y la fecha y hora.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  urlDelPdfPublico,
  crearClaveCertificado,
  esIdCertificadoValido,
  urlDelCertificadoPublico,
  esClaveCertificadoValida,
  formatearFechaHoraCertificado,
} from '../../src/utils/certificado-publico.mjs';
import {
  crearClaveOnerrd,
  esClaveOnerrdValida,
  formatearFechaHoraOnerrd,
} from '../../src/utils/certificado-onerrd.mjs';

const ID = 'CERT-20261007-094900-12345';

test('el QR de un certificado de curso abre su página con su propia clave', () => {
  const clave = crearClaveCertificado();
  assert.ok(esClaveCertificadoValida(clave));
  assert.notEqual(clave, crearClaveCertificado());

  assert.equal(
    urlDelCertificadoPublico('https://explora.app/', ID, clave),
    `https://explora.app/certificados/${ID}?c=${clave}`
  );
  assert.equal(urlDelPdfPublico(ID, clave), `/api/certificados/${ID}?c=${clave}`);
  assert.equal(
    urlDelPdfPublico(ID, clave, { descargar: true }),
    `/api/certificados/${ID}?c=${clave}&descargar=1`
  );

  // Sin clave (los creados antes del cambio): '' y el QR sigue con su PDF.
  assert.equal(urlDelCertificadoPublico('https://explora.app', ID, ''), '');
  assert.equal(urlDelPdfPublico(ID, 'corta'), '');
});

test('solo entran ids de certificado con la forma de los guardados', () => {
  assert.equal(esIdCertificadoValido(ID), true);
  assert.equal(esIdCertificadoValido('CERT-20261007-094900-juan.perez'), true);
  assert.equal(esIdCertificadoValido('CERT-20261007-094900-../x'), false);
  assert.equal(esIdCertificadoValido('CERT-20261007-094900-a/b'), false);
  assert.equal(esIdCertificadoValido('2027-004'), false);
  assert.equal(esIdCertificadoValido(''), false);
});

test('ONERRD y los de curso comparten clave y fecha y hora de generación', () => {
  assert.equal(crearClaveOnerrd, crearClaveCertificado);
  assert.equal(esClaveOnerrdValida, esClaveCertificadoValida);
  assert.equal(formatearFechaHoraOnerrd, formatearFechaHoraCertificado);
  // En hora de Santo Domingo, dé igual la del equipo.
  assert.equal(formatearFechaHoraCertificado('2026-10-07T13:49:00Z'), '07/10/2026 9:49 a. m.');
});
