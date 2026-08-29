import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { resolverAccesoPorCargo } = await import('../../src/server/rol-por-cargo.js');

// ----------------------------------------------------------------------
// Un rol puesto a mano no lo borra una casilla del organigrama.
//
// La Oficina Nacional no ocupa casilla: se nombra a mano. Pero el rol se
// recalculaba desde las asignaciones, asi que en cuanto esa misma persona
// recibia un cargo en su destacamento su Oficina Nacional DESAPARECIA —perdia la
// bandeja de aprobaciones, las reglas de Firestore dejaban de reconocerla, y los
// avisos de cambios pendientes, que se reparten buscando ese rol, ya no le
// llegaban—.
//
// Ahora manda el rol de a mano y sus cargos se suman debajo.
// ----------------------------------------------------------------------

const coordinadorDeDestacamento = (idDestacamento) => [
  {
    idPosicionDirectiva: 'destacamento-coordinador-destacamento',
    nivel: 'destacamento',
    idEntidad: String(idDestacamento),
    activo: true,
  },
];

test('sin rol a mano, el rol sale de su casilla', () => {
  const acceso = resolverAccesoPorCargo(coordinadorDeDestacamento(231));

  assert.equal(acceso.rolId, 'usuario_destacamento');
});

test('la Oficina Nacional sigue siendo Oficina Nacional aunque coordine su destacamento', () => {
  const acceso = resolverAccesoPorCargo(coordinadorDeDestacamento(231), {
    rolFijo: 'oficina_nacional',
  });

  assert.equal(acceso.rolId, 'oficina_nacional');
});

test('y no pierde lo que le da su casilla', () => {
  const acceso = resolverAccesoPorCargo(coordinadorDeDestacamento(231), {
    rolFijo: 'oficina_nacional',
  });

  // El cargo se escribe igual: es lo que las reglas miran para dejarle tocar SU
  // destacamento.
  assert.equal(acceso.cargos.length, 1);
  assert.deepEqual(acceso.alcance.destacamentos, ['231']);
  // Los permisos se suman: aprobar cambios es suyo por Oficina Nacional, y
  // editar miembros por su casilla.
  assert.equal(acceso.permisos.includes('organizacion.aprobar_cambios'), true);
  assert.equal(acceso.permisos.includes('miembros.editar'), true);
});

test('el Administrador Global tampoco se convierte en Coordinador', () => {
  const acceso = resolverAccesoPorCargo(coordinadorDeDestacamento(231), {
    rolFijo: 'administrador_global',
  });

  assert.equal(acceso.rolId, 'administrador_global');
  assert.deepEqual(acceso.alcance.destacamentos, ['231']);
});

test('sin ninguna casilla, el rol de a mano se conserva solo', () => {
  const acceso = resolverAccesoPorCargo([], { rolFijo: 'oficina_nacional' });

  assert.equal(acceso.rolId, 'oficina_nacional');
  assert.deepEqual(acceso.cargos, []);
  assert.equal(acceso.permisos.includes('organizacion.aprobar_cambios'), true);
});
