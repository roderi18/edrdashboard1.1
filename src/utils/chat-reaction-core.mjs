const EMOJI_PATTERN =
  /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Presentation})/u;
const KEYCAP_PATTERN = /^[#*0-9]\uFE0F?\u20E3$/u;
const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

const isSingleGrapheme = (value) => {
  if (!segmenter) return Array.from(value).length === 1 || value.includes('\u200D');

  return Array.from(segmenter.segment(value)).length === 1;
};

export const normalizeEmojiReaction = (value) => {
  const reaction = String(value ?? '')
    .replace(/\0/g, '')
    .trim()
    .normalize('NFC');

  if (!reaction || reaction.length > 64 || !isSingleGrapheme(reaction)) return '';
  if (!KEYCAP_PATTERN.test(reaction) && !EMOJI_PATTERN.test(reaction)) return '';

  return reaction;
};

export const toggleChatReaction = (reactions, memberId, reaction) => {
  const reactionKey = String(memberId ?? '').trim();
  const normalizedReaction = normalizeEmojiReaction(reaction);
  const nextReactions = { ...(reactions && typeof reactions === 'object' ? reactions : {}) };

  if (!reactionKey || !normalizedReaction) return nextReactions;

  if (normalizeEmojiReaction(nextReactions[reactionKey]) === normalizedReaction) {
    delete nextReactions[reactionKey];
  } else {
    nextReactions[reactionKey] = normalizedReaction;
  }

  return nextReactions;
};
