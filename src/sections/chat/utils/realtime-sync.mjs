import { chatMessageToUi } from '../../../server/chat-message-model.mjs';

const asArray = (value) => (Array.isArray(value) ? value : []);

export const mergeRealtimeMessageChanges = ({
  messages = [],
  changes = [],
  allowInsert = true,
} = {}) => {
  const byId = new Map(asArray(messages).map((message) => [String(message.id), message]));

  asArray(changes).forEach((change) => {
    const id = String(change?.id ?? change?.data?.idMensaje ?? '');
    if (!id) return;

    if (change.type === 'removed') {
      byId.delete(id);
      return;
    }

    const existing = byId.get(id);
    if (!existing && !allowInsert) return;

    const incoming = chatMessageToUi({ ...change.data, idMensaje: id });
    const merged = {
      ...(existing ?? {}),
      ...incoming,
      deliveryStatus: existing?.deliveryStatus ?? incoming.deliveryStatus,
      deliveredToMemberIds:
        existing?.deliveredToMemberIds ?? incoming.deliveredToMemberIds,
      seenByMemberIds: existing?.seenByMemberIds ?? incoming.seenByMemberIds,
      // Un mensaje eliminado nunca conserva reacciones, incluso al recibir
      // documentos históricos creados antes de esta regla.
      reactions: incoming.eliminado ? {} : incoming.reactions,
    };

    byId.set(id, merged);
  });

  return Array.from(byId.values()).sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime()
  );
};

export const getActiveTypingState = ({
  typingByMember = {},
  currentMemberId,
  now = Date.now(),
  staleMs = 4_000,
} = {}) => {
  const active = Object.entries(typingByMember ?? {})
    .map(([id, timestamp]) => ({ id, timestamp: new Date(timestamp).getTime() }))
    .filter(
      (item) =>
        Number(item.id) !== Number(currentMemberId) &&
        Number.isFinite(item.timestamp) &&
        now - item.timestamp >= 0 &&
        now - item.timestamp < staleMs
    );

  return {
    ids: active.map((item) => item.id),
    expiresIn:
      active.length > 0
        ? Math.max(0, Math.min(...active.map((item) => item.timestamp + staleMs - now)))
        : null,
  };
};

export const getConversationDeliveryMarker = ({ conversation, currentMemberId } = {}) => {
  const lastMessage = conversation?.ultimoMensaje;

  if (!lastMessage?.idMensaje) return null;
  if (Number(lastMessage.remitenteIdMiembros) === Number(currentMemberId)) return null;

  return `${lastMessage.idMensaje}:${lastMessage.enviadoEn ?? conversation?.actualizadoEn ?? ''}`;
};
