import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReactionGroups } from '../../src/sections/chat/utils/reaction-groups.mjs';

test('agrupa emojis iguales y conserva quiénes reaccionaron', () => {
  const groups = buildReactionGroups({
    reactions: { 42: '❤️', 84: '❤️', 99: '👍' },
    participants: [
      { idMiembros: 42, name: 'Alanna Donald' },
      { idMiembros: 84, name: 'Oliver Feliz' },
      { idMiembros: 99, name: 'Roderi Peña' },
    ],
    currentContact: { idMiembros: 84, name: 'Oliver Feliz' },
  });

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], {
    emoji: '❤️',
    memberIds: ['42', '84'],
    names: ['Alanna Donald', 'Oliver Feliz (Tú)'],
    count: 2,
  });
  assert.equal(groups[1].emoji, '👍');
  assert.equal(groups[1].count, 1);
});

test('ignora reacciones vacías y usa un nombre seguro si falta el contacto', () => {
  const groups = buildReactionGroups({ reactions: { 42: '', 84: '🎉' } });

  assert.deepEqual(groups, [
    { emoji: '🎉', memberIds: ['84'], names: ['Miembro'], count: 1 },
  ]);
});
