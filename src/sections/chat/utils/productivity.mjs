const asArray = (value) => (Array.isArray(value) ? value : []);
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const buildChatDraftKey = ({ currentMemberId, conversationId, recipientIds = [] } = {}) => {
  const memberId = String(currentMemberId ?? '').trim();
  if (!memberId) return null;

  const target = conversationId
    ? `conversation:${String(conversationId)}`
    : `compose:${[...new Set(asArray(recipientIds).map(String).filter(Boolean))].sort().join(',')}`;

  return `chat-draft:v1:${memberId}:${target}`;
};

export const resolveMentionIds = (text, participants = []) => {
  const normalizedText = normalize(text);

  return [...new Set(
    asArray(participants)
      .filter((participant) => {
        const name = normalize(participant?.name);

        return name && normalizedText.includes(`@${name}`);
      })
      .map((participant) => Number(participant.idMiembros ?? participant.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0)
  )];
};

export const getNextUnreadConversationId = ({
  allIds = [],
  byId = {},
  currentId,
  direction = 1,
} = {}) => {
  const unreadIds = asArray(allIds).filter((id) => Number(byId[id]?.unreadCount) > 0);
  if (!unreadIds.length) return null;

  const currentIndex = unreadIds.findIndex((id) => String(id) === String(currentId));
  const startIndex = currentIndex < 0 ? (direction < 0 ? 0 : -1) : currentIndex;

  return unreadIds[(startIndex + direction + unreadIds.length) % unreadIds.length] ?? null;
};

export const searchChatDirectory = ({
  query,
  contacts = [],
  conversations = { allIds: [], byId: {} },
  currentMemberId,
} = {}) => {
  const term = normalize(query);
  if (!term) return { contacts: [], conversations: [] };

  const contactResults = asArray(contacts).filter((contact) =>
    [contact.name, contact.codigoMiembro]
      .map(normalize)
      .filter(Boolean)
      .some((value) => value.includes(term))
  );
  const conversationResults = asArray(conversations.allIds)
    .map((id) => conversations.byId?.[id])
    .filter(Boolean)
    .filter((conversation) => {
      const participantNames = asArray(conversation.participants)
        .filter(
          (participant) =>
            String(participant.idMiembros ?? participant.id) !== String(currentMemberId ?? '')
        )
        .map((participant) => participant.name);
      const lastMessage = asArray(conversation.messages).at(-1)?.body;

      return [conversation.groupName, ...participantNames, lastMessage]
        .map(normalize)
        .filter(Boolean)
        .some((value) => value.includes(term));
    });

  return { contacts: contactResults, conversations: conversationResults };
};
