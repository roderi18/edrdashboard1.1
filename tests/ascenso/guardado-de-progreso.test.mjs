import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL GUARDADO DE UN PREMIO BORRA LO QUE SE PIDE BORRAR Y NO SE PISA.
//
// Qué se rompía:
//   - Quitar un completado o borrar su certificado no llegaba a Firestore: el
//     guardado hacía `certificado || lo_anterior` y al recargar el certificado
//     (y la fecha de completado) volvían.
//   - Dos guardados seguidos del mismo premio se pisaban: el que terminaba
//     último ganaba y un premio "quitado" podía quedar completado.
//   - Un premio leído sin certificado vale `null` en memoria: mandarlo tal cual
//     al completar borraría uno subido entretanto por otra persona.

const { camposDelProgreso, enColaDelPremio } =
  await import('src/services/member-awards-service.js');

const AHORA = '2026-09-24T12:00:00.000Z';
const CERTIFICADO_PREVIO = { id: 'CERT-1', nombre: 'a.pdf', rutaPdf: 'certificados/a.pdf' };
const PREVIO = {
  estado: 'completado',
  fechaCompletado: '2026-01-01T00:00:00.000Z',
  vecesCompletado: 2,
  idCertificadoActual: 'CERT-1',
  idsCertificados: ['CERT-0', 'CERT-1'],
  certificadoActual: CERTIFICADO_PREVIO,
};

test('certificado: null lo borra (y lo quita de la lista de certificados)', () => {
  const campos = camposDelProgreso({
    previous: PREVIO,
    estado: 'no_iniciado',
    vecesCompletado: 0,
    certificado: null,
    now: AHORA,
  });

  assert.equal(campos.borrarCertificado, true);
  assert.equal(campos.idCertificadoActual, '');
  assert.equal(campos.certificadoActual, null);
  assert.deepEqual(campos.idsCertificados, ['CERT-0']);
});

test('certificado sin decir (undefined) deja el que había', () => {
  const campos = camposDelProgreso({
    previous: PREVIO,
    estado: 'completado',
    certificado: undefined,
    now: AHORA,
  });

  assert.equal(campos.borrarCertificado, false);
  assert.equal(campos.idCertificadoActual, 'CERT-1');
  assert.deepEqual(campos.certificadoActual, CERTIFICADO_PREVIO);
});

test('sin completar no queda fecha de completado; completado conserva la suya', () => {
  const quitado = camposDelProgreso({ previous: PREVIO, estado: 'no_iniciado', now: AHORA });
  const sigue = camposDelProgreso({ previous: PREVIO, estado: 'completado', now: AHORA });
  const nuevo = camposDelProgreso({ previous: {}, estado: 'completado', now: AHORA });

  assert.equal(quitado.fechaCompletado, null);
  assert.equal(sigue.fechaCompletado, PREVIO.fechaCompletado);
  assert.equal(nuevo.fechaCompletado, AHORA);
});

test('un certificado nuevo pasa a ser el actual y se suma a la lista', () => {
  const campos = camposDelProgreso({
    previous: PREVIO,
    estado: 'completado',
    certificado: { id: 'CERT-2', name: 'b.pdf' },
    now: AHORA,
  });

  assert.equal(campos.idCertificadoActual, 'CERT-2');
  assert.deepEqual(campos.idsCertificados, ['CERT-0', 'CERT-1', 'CERT-2']);
});

test('los guardados del mismo premio van en fila, en el orden en que se piden', async () => {
  const orden = [];
  const tarea = (nombre, ms) => () =>
    new Promise((resolver) => {
      setTimeout(() => {
        orden.push(nombre);
        resolver(nombre);
      }, ms);
    });

  // El primero tarda más: sin la fila, el segundo terminaría antes.
  await Promise.all([
    enColaDelPremio('miembro_premio', tarea('borrar-certificado', 30)),
    enColaDelPremio('miembro_premio', tarea('quitar-completado', 1)),
  ]);

  assert.deepEqual(orden, ['borrar-certificado', 'quitar-completado']);
});

test('un fallo en la fila no bloquea los guardados siguientes', async () => {
  const fallo = enColaDelPremio('otro', () => Promise.reject(new Error('sin red')));
  const siguiente = enColaDelPremio('otro', () => Promise.resolve('ok'));

  await assert.rejects(fallo);
  assert.equal(await siguiente, 'ok');
});

test('premios distintos no se esperan entre sí', async () => {
  const orden = [];
  await Promise.all([
    enColaDelPremio('a', () => new Promise((r) => setTimeout(() => r(orden.push('a')), 30))),
    enColaDelPremio('b', () => new Promise((r) => setTimeout(() => r(orden.push('b')), 1))),
  ]);

  assert.deepEqual(orden, ['b', 'a']);
});
