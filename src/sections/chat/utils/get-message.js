// ----------------------------------------------------------------------

const normalizeId = (value) => String(value ?? '').trim();

export function getMessage({ message, participants, currentUserId }) {
  const currentUserIds = (Array.isArray(currentUserId) ? currentUserId : [currentUserId])
    .map(normalizeId)
    .filter(Boolean);
  const senderId = normalizeId(message.senderId);
  const sender = participants.find((participant) =>
    [participant.id, participant.idMiembros].map(normalizeId).includes(senderId)
  );

  const isCurrentUser = currentUserIds.includes(senderId);

  const senderDetails = isCurrentUser
    ? { type: 'me' }
    : { avatarUrl: sender?.avatarUrl, firstName: sender?.name?.split(' ')[0] ?? 'Desconocido' };

  const hasImage = message.contentType === 'image';

  return { hasImage, me: isCurrentUser, senderDetails };
}
