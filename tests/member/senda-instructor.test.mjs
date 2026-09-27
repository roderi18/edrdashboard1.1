import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LA SENDA DEL INSTRUCTOR SE MARCA CON CASILLAS.
//
// Cuatro niveles en su orden; Calificado (IQ) y Especializado (IE) salen pero
// deshabilitados, porque todavía no se otorgan. Se guarda una lista: lo que no
// sea un nivel conocido se descarta para que la ficha no pinte basura.

const { NIVELES_SENDA_INSTRUCTOR, normalizarSendaInstructor } = await import(
  '../../src/utils/senda-instructor.mjs'
);

test('cuatro niveles en orden y los dos últimos deshabilitados', () => {
  assert.deepEqual(
    NIVELES_SENDA_INSTRUCTOR.map((n) => n.value),
    ['IF', 'IC', 'IQ', 'IE']
  );
  assert.deepEqual(
    NIVELES_SENDA_INSTRUCTOR.filter((n) => n.deshabilitado).map((n) => n.value),
    ['IQ', 'IE']
  );
});

test('se guarda una lista limpia y en el orden de la senda', () => {
  assert.deepEqual(normalizarSendaInstructor(['IC', 'IF', 'XX']), ['IF', 'IC']);
  assert.deepEqual(normalizarSendaInstructor('IC'), ['IC']);
  assert.deepEqual(normalizarSendaInstructor(undefined), []);
});
