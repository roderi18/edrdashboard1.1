const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const memberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const validIso = (value) => {
  const timestamp = new Date(value ?? '').getTime();

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};
const latestIso = (...values) =>
  values.map(validIso).filter(Boolean).sort((a, b) => a.localeCompare(b)).at(-1) ?? null;

export const shouldAdvanceChatReceipt = ({
  existing = {},
  deliveredUntil,
  readUntil,
} = {}) => {
  const currentDelivered = validIso(existing.entregadoHasta);
  const currentRead = validIso(existing.leidoHasta);
  const nextDelivered = latestIso(deliveredUntil, readUntil);
  const nextRead = validIso(readUntil);

  return Boolean(
    (nextDelivered && (!currentDelivered || nextDelivered > currentDelivered)) ||
      (nextRead && (!currentRead || nextRead > currentRead))
  );
};

export const buildChatReceipt = ({
  existing = {},
  idMiembros,
  deliveredUntil,
  readUntil,
  now = new Date().toISOString(),
} = {}) => {
  const normalizedMemberId = memberId(idMiembros);

  if (!normalizedMemberId) throw new TypeError('El recibo requiere un miembro válido.');

  const entregadoHasta = latestIso(existing.entregadoHasta, deliveredUntil, readUntil);
  const leidoHasta = latestIso(existing.leidoHasta, readUntil);

  return {
    idMiembros: normalizedMemberId,
    entregadoHasta,
    leidoHasta,
    actualizadoEn: validIso(now) ?? new Date().toISOString(),
  };
};

export const applyChatReceiptsToMessages = ({ messages = [], participantIds = [], receipts = [] } = {}) => {
  const receiptsByMember = new Map(
    asArray(receipts)
      .map((receipt) => [memberId(receipt?.idMiembros), asObject(receipt)])
      .filter(([id]) => id)
  );
  const normalizedParticipants = Array.from(
    new Set(asArray(participantIds).map(memberId).filter(Boolean))
  );

  return asArray(messages).map((message) => {
    const sentAt = validIso(message.enviadoEn ?? message.createdAt);
    const senderId = memberId(message.remitenteIdMiembros ?? message.senderId);
    const recipients = normalizedParticipants.filter((id) => id !== senderId);
    const deliveredToMemberIds = recipients.filter((id) => {
      const deliveredUntil = validIso(receiptsByMember.get(id)?.entregadoHasta);

      return sentAt && deliveredUntil && deliveredUntil >= sentAt;
    });
    const seenByMemberIds = recipients.filter((id) => {
      const readUntil = validIso(receiptsByMember.get(id)?.leidoHasta);

      return sentAt && readUntil && readUntil >= sentAt;
    });
    const deliveryStatus =
      recipients.length && seenByMemberIds.length === recipients.length
        ? 'visto'
        : recipients.length && deliveredToMemberIds.length === recipients.length
          ? 'entregado'
          : 'enviado';

    return {
      ...message,
      deliveryStatus,
      deliveredToMemberIds,
      seenByMemberIds,
    };
  });
};
