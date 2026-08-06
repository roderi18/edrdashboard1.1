import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { toggleChatReaction, normalizeEmojiReaction } from '../../src/utils/chat-reaction-core.mjs';

const reactionUiSource = await readFile(
  new URL('../../src/sections/chat/chat-message-item.jsx', import.meta.url),
  'utf8'
);

test('acepta un solo grafema emoji Unicode incluyendo familias, tonos, banderas y teclas', () => {
  assert.equal(normalizeEmojiReaction(' 👨‍👩‍👧‍👦 '), '👨‍👩‍👧‍👦');
  assert.equal(normalizeEmojiReaction('👍🏽'), '👍🏽');
  assert.equal(normalizeEmojiReaction('🇩🇴'), '🇩🇴');
  assert.equal(normalizeEmojiReaction('1️⃣'), '1️⃣');
});

test('rechaza texto, cadenas mixtas y múltiples emojis como reacción', () => {
  assert.equal(normalizeEmojiReaction('me gusta'), '');
  assert.equal(normalizeEmojiReaction('👍 ok'), '');
  assert.equal(normalizeEmojiReaction('👍👍'), '');
});

test('cada usuario conserva una sola reacción y repetirla la alterna', () => {
  const initial = { 42: '👍', 84: '❤️' };
  const changed = toggleChatReaction(initial, 42, '🎉');

  assert.deepEqual(changed, { 42: '🎉', 84: '❤️' });
  assert.deepEqual(toggleChatReaction(changed, 42, '🎉'), { 84: '❤️' });
  assert.deepEqual(initial, { 42: '👍', 84: '❤️' });
});

test('el selector completo y los chips agrupados exponen controles accesibles', () => {
  assert.match(reactionUiSource, /COMPLETE_REACTION_EMOJI_CATEGORIES/);
  assert.match(reactionUiSource, /aria-label={`Reaccionar con \$\{emoji\}`}/);
  assert.match(reactionUiSource, /aria-pressed={selectedReactionEmoji === emoji}/);
  assert.match(reactionUiSource, /group\.names\.join/);
  assert.match(reactionUiSource, /setLocalReactions\(previousReactions\)/);
});
