import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAssignedDestIds,
  mergeCombinedRoleScope,
  mergeCombinedRolePermissions,
} from '../../src/auth/permissions/combined-role-access.js';

test('el cargo seccional no elimina el permiso de editar del cargo de destacamento', () => {
  const permissions = mergeCombinedRolePermissions(
    ['miembros.ver'],
    ['destacamentos.editar'],
    ['miembros.ver', 'miembros.editar']
  );

  assert.deepEqual(permissions, ['miembros.ver', 'destacamentos.editar', 'miembros.editar']);
});

test('el alcance principal seccional conserva el destacamento del cargo local', () => {
  const scope = mergeCombinedRoleScope(
    { modo: 'seccion', secciones: [18], destacamentos: [] },
    {
      member: { idDestacamento: 231 },
      profile: {
        alcance: { destacamentos: [231], secciones: [18], regiones: [4] },
      },
    },
    'seccion'
  );

  assert.equal(scope.modo, 'seccion');
  assert.deepEqual(scope.destacamentos, [231]);
  assert.deepEqual(scope.secciones, [18]);
  assert.deepEqual(scope.regiones, [4]);
});

test('la unión de alcances no inventa destacamentos fuera de la combinación', () => {
  const scope = mergeCombinedRoleScope(
    { modo: 'seccion', secciones: [18] },
    { profile: { alcance: { destacamentos: [231] } } },
    'seccion'
  );

  assert.deepEqual(scope.destacamentos, [231]);
  assert.equal(scope.destacamentos.includes(233), false);
});

test('solo el destacamento asignado al cargo local se considera propio', () => {
  const ownDestIds = getAssignedDestIds(
    [
      { rol: 'usuario_seccion_asistente', nivel: 'seccional', idEntidad: 18 },
      { rol: 'usuario_destacamento_asistente', nivel: 'destacamento', idEntidad: 231 },
    ],
    ['usuario_destacamento_asistente']
  );

  assert.deepEqual(ownDestIds, [231]);
  assert.equal(ownDestIds.includes(233), false);
});
