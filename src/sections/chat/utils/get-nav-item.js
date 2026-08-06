// ----------------------------------------------------------------------

export function getNavItem({ currentUserId, conversation }) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];

  const participantsInConversation = participants.filter(
    (participant) =>
      String(participant.idMiembros ?? participant.id ?? '') !== String(currentUserId ?? '')
  );

  const lastMessage = messages[messages.length - 1];

  const group = participantsInConversation.length > 1;

  const displayName =
    (group && conversation.groupName) ||
    participantsInConversation.map((participant) => participant.name).join(', ');

  let displayText = '';

  if (lastMessage) {
    const sender = lastMessage.senderId === currentUserId ? 'Tú: ' : '';

    const message = lastMessage.contentType === 'image' ? 'Envió una foto' : lastMessage.body;

    displayText = `${sender}${message}`;
  }

  return {
    group,
    displayName,
    displayText,
    participants: participantsInConversation,
    lastActivity:
      lastMessage?.createdAt ??
      conversation?.updatedAt ??
      conversation?.createdAt ??
      null,
  };
}
