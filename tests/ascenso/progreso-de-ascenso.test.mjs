import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// LA TARJETA DE PROGRESO DICE LO MISMO QUE LA TABLA.
//
// La raíz de /edit/awards lleva encima de la tabla un resumen del avance. Si
// contara distinto que las filas (carpetas como adiestramientos, completados de
// otra rama, más del 100 %), la misma pantalla daría dos cifras para el mismo
// programa. Aquí se fija la cuenta con el catálogo REAL y con un árbol pequeño.

const { _awards } = await import('src/_mock/_awards.js');
const { resumirProgresoDeAscenso } = await import('src/utils/progreso-de-ascenso.mjs');
const { getTotalAwards } = await import('src/sections/member/awards/utils/get-awards-count.js');

const ARBOL = [
  {
    id: 'sistema-de-ascenso',
    type: 'folder',
    parentId: null,
    name: 'Sistema de Ascenso',
    target: 'Muchachos',
  },
  {
    id: 'academia-ministerial',
    type: 'folder',
    parentId: null,
    name: 'Academia Ministerial',
    target: 'Líderes',
  },
  { id: 'div', type: 'folder', parentId: 'sistema-de-ascenso' },
  { id: 'premio', type: 'folder', parentId: 'div' },
  { id: 'a1', type: 'pdf', parentId: 'premio' },
  { id: 'a2', type: 'pdf', parentId: 'premio' },
  { id: 'a3', type: 'pdf', parentId: 'premio' },
  { id: 'curso', type: 'folder', parentId: 'academia-ministerial' },
  { id: 'c1', type: 'pdf', parentId: 'curso' },
  { id: 'c2', type: 'pdf', parentId: 'curso' },
];

test('el total de cada programa es el mismo que enseña su fila en la tabla', () => {
  const { programas } = resumirProgresoDeAscenso(_awards, {});

  programas.forEach((programa) => {
    assert.equal(programa.total, getTotalAwards(programa.id, _awards), programa.id);
  });
});

test('sin nada completado: 0 %, ningún programa completo y el primero como siguiente', () => {
  const resumen = resumirProgresoDeAscenso(ARBOL, {});

  assert.equal(resumen.total, 5);
  assert.equal(resumen.completados, 0);
  assert.equal(resumen.porcentaje, 0);
  assert.equal(resumen.programasCompletos, 0);
  assert.equal(resumen.siguiente.id, 'sistema-de-ascenso');
});

test('los completados salen de la rama de cada programa y solo cuentan "completado"', () => {
  const resumen = resumirProgresoDeAscenso(ARBOL, {
    sistemaAscenso: { div: { premio: { a1: 'completado', a2: 'en_progreso' } } },
    academia: { curso: { c1: 'completado' } },
  });

  const [sistema, academia] = resumen.programas;
  assert.equal(sistema.completados, 1);
  assert.equal(academia.completados, 1);
  assert.equal(resumen.completados, 2);
  assert.equal(resumen.porcentaje, 40);
  // Academia va al 50 % y el Sistema al 33 %: el siguiente es el más avanzado.
  assert.equal(resumen.siguiente.id, 'academia-ministerial');
  assert.equal(resumen.siguiente.pendientes, 1);
});

test('un programa terminado cuenta como completo y deja de ser el siguiente', () => {
  const resumen = resumirProgresoDeAscenso(ARBOL, {
    academia: { curso: { c1: 'completado', c2: 'completado' } },
  });

  assert.equal(resumen.programasCompletos, 1);
  assert.equal(resumen.siguiente.id, 'sistema-de-ascenso');
});

test('estados de premios que ya no están en el catálogo no pasan del 100 %', () => {
  const resumen = resumirProgresoDeAscenso(ARBOL, {
    academia: { curso: { c1: 'completado', c2: 'completado', viejo: 'completado' } },
    sistemaAscenso: { div: { premio: { a1: 'completado', a2: 'completado', a3: 'completado' } } },
  });

  assert.equal(resumen.completados, 5);
  assert.equal(resumen.porcentaje, 100);
  assert.equal(resumen.programasCompletos, 2);
  assert.equal(resumen.siguiente, null);
});
