import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// EL PASTOR DEL DESTACAMENTO NO PASA LISTA.
//
// Ocupa una casilla de la directiva, pero no es uno de los muchachos: salia en
// /attendance como uno mas, con su fila y su "Sin registro", asi que cada
// reunion quedaba con un ausente que nunca iba a estar y el porcentaje de
// asistencia salia peor de lo que fue.
// ----------------------------------------------------------------------

const { idsDePastores, sinLosPastores, POSICION_PASTOR_DESTACAMENTO } =
  await import('src/utils/pastores-de-destacamento.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const ASIGNACIONES = [
  // Como las guarda el formulario del Pastor hoy.
  { idPosicionDirectiva: 'destacamento-pastor', idMiembro: '328', activo: true },
  // Como quedaron las primeras, sin el campo `activo`.
  { idPosicionDirectiva: 'destacamento-pastor', idMiembro: '303' },
  // Un pastor que ya no lo es.
  { idPosicionDirectiva: 'destacamento-pastor', idMiembro: '999', activo: false },
  // El resto de la directiva sigue pasando lista.
  { idPosicionDirectiva: 'destacamento-coordinador', idMiembro: '147', activo: true },
];

test('se reconoce al Pastor por su posición en la directiva', () => {
  assert.equal(POSICION_PASTOR_DESTACAMENTO, 'destacamento-pastor');
  assert.deepEqual([...idsDePastores(ASIGNACIONES)].sort(), ['303', '328']);
});

// Las primeras asignaciones no traen `activo`: pedirlo estricto dejaba fuera a
// los pastores mas antiguos y volvian a salir en la lista.
test('una asignación sin el campo `activo` sigue contando', () => {
  assert.ok(
    idsDePastores([{ idPosicionDirectiva: 'destacamento-pastor', idMiembro: '303' }]).has('303')
  );
});

test('quien ya no es Pastor vuelve a la lista', () => {
  assert.ok(!idsDePastores(ASIGNACIONES).has('999'));
});

test('la lista de asistencia sale sin los pastores y con todos los demás', () => {
  const miembros = [{ id: '303' }, { id: '328' }, { id: '147' }, { id: '999' }];
  const restantes = sinLosPastores(miembros, idsDePastores(ASIGNACIONES), (miembro) => miembro.id);

  assert.deepEqual(
    restantes.map((miembro) => miembro.id),
    ['147', '999']
  );
});

test('sin lista de pastores no se esconde a nadie', () => {
  const miembros = [{ id: '1' }, { id: '2' }];

  assert.equal(sinLosPastores(miembros, new Set(), (miembro) => miembro.id).length, 2);
  assert.equal(idsDePastores(null).size, 0);
});

test('el pase de lista aplica el filtro con la directiva del destacamento elegido', () => {
  const vista = leer('src/sections/attendance/view/attendance-quick-view.jsx');

  assert.match(vista, /obtenerAsignacionesDirectiva\(\{\s*nivel: 'destacamento'/);
  assert.match(vista, /incluirInactivas: true/);
  assert.match(vista, /sinLosPastores\(/);
  // Si la directiva falla, se enseña a todo el mundo: perder a un muchacho de la
  // lista es peor que enseñar al Pastor.
  assert.match(vista, /if \(activo\) setPastoresDelDestacamento\(new Set\(\)\);/);
});
