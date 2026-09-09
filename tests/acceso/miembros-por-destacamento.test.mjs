import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// CADA DESTACAMENTO ENSEÑA LOS SUYOS.
//
// /member juntaba en una sola lista a los de todos los destacamentos que el
// cargo alcanzaba: un Coordinador Seccional veia ahi revueltos a los de sus
// destacamentos, sin que la lista dijera de donde era cada quien. Ahora la lista
// general es la del destacamento propio, y a los de otro se llega por la pestaña
// "Miembros" de SU destacamento.

const { CONTEXTO, ENTIDADES, construirUsuarioSimulado } = await import(
  '../../src/utils/simulador-permisos.js'
);

const { ROL_COMBINABLE_POR_CODIGO } = await import('../../src/catalogs/combinaciones-roles.js');

const {
  filterMembersByMemberScope,
  puedeVerMiembrosDelDestacamento,
  filtrarMiembrosDentroDelAlcance,
} = await import('../../src/utils/member-access.js');

const ESTRUCTURA = {
  dests: [ENTIDADES.destacamentoPropio, ENTIDADES.destacamentoAjeno],
  churches: [],
  sectionals: [ENTIDADES.seccionPropia],
};

const ficha = (id, destacamento) => ({
  id,
  idMiembros: Number(id),
  idDestacamento: destacamento,
  destId: destacamento,
});

const PADRON = [
  ficha('901', CONTEXTO.destacamentoPropio),
  ficha('903', CONTEXTO.destacamentoAjeno),
];

// Los cargos REALES del catalogo: el simulador arma con ellos la misma sesion
// que la aplicacion, con su alcance y su rol principal.
const rol = (codigo) => ROL_COMBINABLE_POR_CODIGO[codigo];

const coordinadorDeSeccion = construirUsuarioSimulado([rol('usuario_seccion')]);

const coordinadorDeDestacamento = construirUsuarioSimulado([rol('usuario_destacamento')]);

const administradorGlobal = { role: 'admin', rolId: 'administrador_global' };

test('la lista general del cargo de seccion se queda en su destacamento', () => {
  const visibles = filterMembersByMemberScope(PADRON, coordinadorDeSeccion, ESTRUCTURA);

  assert.deepEqual(
    visibles.map((m) => m.destId),
    [CONTEXTO.destacamentoPropio]
  );
});

test('el Administrador Global sigue viendo el padron entero', () => {
  assert.equal(filterMembersByMemberScope(PADRON, administradorGlobal, ESTRUCTURA).length, 2);
});

test('a los del destacamento de al lado se llega por su destacamento', () => {
  // El cargo de seccion los alcanza: la pestaña de ese destacamento se los enseña.
  assert.equal(
    puedeVerMiembrosDelDestacamento(coordinadorDeSeccion, CONTEXTO.destacamentoAjeno, ESTRUCTURA),
    true
  );

  const alcanzables = filtrarMiembrosDentroDelAlcance(PADRON, coordinadorDeSeccion, ESTRUCTURA);

  assert.equal(alcanzables.length, 2);
});

test('un cargo de destacamento no entra en la pestaña del de al lado', () => {
  assert.equal(
    puedeVerMiembrosDelDestacamento(
      coordinadorDeDestacamento,
      CONTEXTO.destacamentoAjeno,
      ESTRUCTURA
    ),
    false
  );

  assert.equal(
    puedeVerMiembrosDelDestacamento(
      coordinadorDeDestacamento,
      CONTEXTO.destacamentoPropio,
      ESTRUCTURA
    ),
    true
  );
});

test('sin destacamento no se abre ninguna pestaña', () => {
  assert.equal(puedeVerMiembrosDelDestacamento(coordinadorDeSeccion, '', ESTRUCTURA), false);
  assert.equal(puedeVerMiembrosDelDestacamento(coordinadorDeSeccion, null, ESTRUCTURA), false);
});
