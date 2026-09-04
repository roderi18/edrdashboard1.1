import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// Casi ningun certificado del Sistema de Ascenso es un PDF: son FOTOS del
// diploma de papel. El visor las metia en un <iframe>, donde el navegador las
// pinta a tamano natural y pegadas a la esquina. Antes de centrarlas hay que
// acertar QUE es cada archivo, y el tipo llega de tres formas distintas.

const { esCertificadoDeImagen } = await import(
  'src/sections/member/awards/utils/tipo-de-certificado.js'
);

test('el data URL lleva el tipo escrito delante', () => {
  assert.equal(esCertificadoDeImagen('data:image/jpeg;base64,/9j/4AAQ'), true);
  assert.equal(esCertificadoDeImagen('data:image/png;base64,iVBORw0K'), true);
  assert.equal(esCertificadoDeImagen('data:application/pdf;base64,JVBERi0'), false);
});

test('la URL de Storage lo dice en la extension, codificada y con la firma detras', () => {
  const foto =
    'https://firebasestorage.googleapis.com/v0/b/edr.appspot.com/o/' +
    'certificados%2Fascenso%2FEDR-10002%2FCERT-ASC-1-fundamentos.jpg?alt=media&token=abc-123';
  const pdf =
    'https://firebasestorage.googleapis.com/v0/b/edr.appspot.com/o/' +
    'certificados%2Fascenso%2FEDR-10002%2FCERT-ASC-1-mentores.pdf?alt=media&token=abc-123';

  assert.equal(esCertificadoDeImagen(foto), true);
  assert.equal(esCertificadoDeImagen(pdf), false);
});

test('cuando la URL no deja ver la extension, la dice el nombre del archivo', () => {
  const sinExtension = 'https://cdn.ejemplo.com/descargar?id=99';

  assert.equal(esCertificadoDeImagen(sinExtension, 'Fundamentos.JPEG'), true);
  assert.equal(esCertificadoDeImagen(sinExtension, 'Fundamentos.pdf'), false);
});

test('ante la duda, se responde que no es imagen y el PDF se queda en su visor', () => {
  assert.equal(esCertificadoDeImagen('', ''), false);
  assert.equal(esCertificadoDeImagen(null, null), false);
  assert.equal(esCertificadoDeImagen(undefined), false);
  assert.equal(esCertificadoDeImagen('https://cdn.ejemplo.com/descargar?id=99'), false);
});

test('una URL mal codificada no rompe la comprobacion', () => {
  // `%E0%A4%A` esta truncado: decodeURIComponent lanza.
  assert.equal(esCertificadoDeImagen('https://cdn.ejemplo.com/%E0%A4%A/foto.png'), true);
  assert.equal(esCertificadoDeImagen('https://cdn.ejemplo.com/%E0%A4%A/doc.pdf'), false);
});
