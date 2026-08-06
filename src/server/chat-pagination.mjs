export const CHAT_CONVERSATIONS_PAGE_SIZE = 30;
export const CHAT_CONVERSATIONS_MAX_PAGE_SIZE = 100;

const validIso = (value) => {
  const timestamp = new Date(value ?? '').getTime();

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

export const normalizeChatPageSize = (value) => {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) return CHAT_CONVERSATIONS_PAGE_SIZE;

  return Math.min(parsed, CHAT_CONVERSATIONS_MAX_PAGE_SIZE);
};

export const encodeConversationCursor = (conversation = {}) => {
  const actualizadoEn = validIso(
    conversation.actualizadoEn ?? conversation.updatedAt ?? conversation.creadoEn
  );
  const id = String(conversation.idConversacion ?? conversation.id ?? '').trim();

  if (!actualizadoEn || !id) return null;

  return Buffer.from(JSON.stringify({ actualizadoEn, id }), 'utf8').toString('base64url');
};

export const decodeConversationCursor = (cursor) => {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    const actualizadoEn = validIso(parsed?.actualizadoEn);
    const id = String(parsed?.id ?? '').trim();

    return actualizadoEn && id ? { actualizadoEn, id } : null;
  } catch {
    return null;
  }
};

export const buildConversationPage = ({ conversations = [], pageSize } = {}) => {
  const normalizedPageSize = normalizeChatPageSize(pageSize);
  const hasMore = conversations.length > normalizedPageSize;
  const page = conversations.slice(0, normalizedPageSize);

  return {
    conversations: page,
    hasMore,
    nextCursor: hasMore ? encodeConversationCursor(page.at(-1)) : null,
  };
};
