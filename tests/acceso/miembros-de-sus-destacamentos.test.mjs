import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// VER SE SUMA; EDITAR NO.
//
// La lista de miembros pregunta a quien VE, y ahi el destacamento del cargo no
// puede borrar aquel al que la persona pertenece: cuando el cargo apuntaba a
// otra entidad, la lista salia vacia —ni los suyos— aunque en Asistencia, que
// acota por el destacamento elegido, siguieran apareciendo.

const { filtrarMiembrosDeSuDestacamento, getOwnDestIdsForUser, getVisibleDestIdsForUser } =
  await import('../../src/utils/member-access.js');

const MIEMBROS = [
  { id: '501', destId: '231' },
  { id: '502', destId: '231' },
  { id: '777', destId: '999' },
];

const coordinador = (idEntidad) => ({
  role: 'member',
  idMiembros: 501,
  alcance: { tipo: 'destacamento', modo: 'destacamento', destacamentos: ['231'] },
  cargos: [{ rol: 'coordinador_destacamento', nivel: 'destacamento', idEntidad, orden: 1 }],
});

test('ve a los de su destacamento aunque el cargo apunte a otra entidad', () => {
  const visibles = filtrarMiembrosDeSuDestacamento(MIEMBROS, coordinador('4321'));

  assert.deepEqual(
    visibles.map((miembro) => miembro.id),
    ['501', '502']
  );
});

test('sigue sin ver los de un destacamento ajeno', () => {
  const visibles = filtrarMiembrosDeSuDestacamento(MIEMBROS, coordinador('231'));

  assert.ok(!visibles.some((miembro) => miembro.destId === '999'));
});

test('editar se queda con el destacamento del cargo local; ver los suma', () => {
  const usuario = coordinador('4321');

  assert.deepEqual([...getOwnDestIdsForUser(usuario)], ['4321']);
  assert.deepEqual([...getVisibleDestIdsForUser(usuario)].sort(), ['231', '4321']);
});
