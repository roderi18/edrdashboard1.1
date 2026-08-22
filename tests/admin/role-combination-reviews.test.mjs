import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isCombinationCapabilityValidated,
  countValidatedCombinationCapabilities,
  mergeCombinationCapabilityReview,
} from '../../src/utils/role-combination-reviews.js';

test('guarda cada fila sin borrar las revisiones anteriores', () => {
  const initial = {
    revisionesCapacidades: {
      'miembros.ver.propio': { validada: true, revisadaPor: 'admin-1' },
    },
  };
  const revisionesCapacidades = mergeCombinationCapabilityReview(
    initial,
    'miembros.editar.propio',
    { validada: true, revisadaPor: 'admin-2' }
  );

  assert.equal(revisionesCapacidades['miembros.ver.propio'].validada, true);
  assert.equal(revisionesCapacidades['miembros.editar.propio'].validada, true);
});

test('cuenta las filas validadas de la combinación seleccionada', () => {
  const document = {
    revisionesCapacidades: {
      'miembros.ver.propio': { validada: true },
      'miembros.editar.propio': { validada: false },
      'salud.ver': true,
    },
  };

  assert.equal(
    countValidatedCombinationCapabilities(document, [
      'miembros.ver.propio',
      'miembros.editar.propio',
      'salud.ver',
    ]),
    2
  );
  assert.equal(isCombinationCapabilityValidated(document, 'miembros.editar.propio'), false);
});
