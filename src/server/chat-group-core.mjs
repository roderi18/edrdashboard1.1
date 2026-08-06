export class ChatGroupError extends Error {
  constructor(message, code = 'CHAT_GROUP_INVALID', status = 400) {
    super(message);
    this.name = 'ChatGroupError';
    this.code = code;
    this.status = status;
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const memberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
const uniqueMemberIds = (values) => Array.from(new Set(asArray(values).map(memberId).filter(Boolean)));

export const getChatGroupState = (conversation = {}) => {
  if (conversation.tipoConversacion !== 'GRUPAL' && conversation.type !== 'GROUP') {
    throw new ChatGroupError('Esta operación solo está disponible en conversaciones grupales.');
  }

  const participantesIds = uniqueMemberIds(conversation.participantesIds);
  const creadoPorIdMiembros = memberId(conversation.creadoPorIdMiembros);
  const administradoresIds = uniqueMemberIds([
    creadoPorIdMiembros,
    ...asArray(conversation.administradoresIds),
  ]).filter((id) => participantesIds.includes(id));

  return { participantesIds, creadoPorIdMiembros, administradoresIds };
};

export const getChatGroupRole = (conversation, idMiembros) => {
  const state = getChatGroupState(conversation);
  const actorId = memberId(idMiembros);

  if (actorId === state.creadoPorIdMiembros) return 'creator';
  if (state.administradoresIds.includes(actorId)) return 'admin';
  if (state.participantesIds.includes(actorId)) return 'member';
  return 'outsider';
};

export const assertChatGroupAdmin = (conversation, idMiembros) => {
  const role = getChatGroupRole(conversation, idMiembros);

  if (!['creator', 'admin'].includes(role)) {
    throw new ChatGroupError(
      'Solo el creador o un administrador puede realizar esta acción.',
      'CHAT_GROUP_ADMIN_REQUIRED',
      403
    );
  }

  return role;
};

export const assertChatGroupCreator = (conversation, idMiembros) => {
  if (getChatGroupRole(conversation, idMiembros) !== 'creator') {
    throw new ChatGroupError(
      'Solo el creador del grupo puede realizar esta acción.',
      'CHAT_GROUP_CREATOR_REQUIRED',
      403
    );
  }
};

export const validateChatGroupRemoval = ({ conversation, actorIdMiembros, targetIdMiembros }) => {
  const state = getChatGroupState(conversation);
  const actorId = memberId(actorIdMiembros);
  const targetId = memberId(targetIdMiembros);
  const actorRole = getChatGroupRole(conversation, actorId);
  const targetRole = getChatGroupRole(conversation, targetId);

  if (!targetId || targetRole === 'outsider') {
    throw new ChatGroupError('El participante indicado no pertenece al grupo.');
  }
  if (targetId === state.creadoPorIdMiembros) {
    throw new ChatGroupError(
      'El creador debe transferir la propiedad antes de abandonar el grupo.',
      'CHAT_GROUP_TRANSFER_REQUIRED'
    );
  }
  if (state.participantesIds.length <= 2) {
    throw new ChatGroupError(
      'El grupo debe conservar al menos dos participantes.',
      'CHAT_GROUP_MIN_PARTICIPANTS'
    );
  }
  if (actorId !== targetId && !['creator', 'admin'].includes(actorRole)) {
    throw new ChatGroupError('No puedes retirar a otro participante.', 'CHAT_GROUP_ADMIN_REQUIRED', 403);
  }
  if (targetRole === 'admin' && actorRole !== 'creator') {
    throw new ChatGroupError(
      'Solo el creador puede retirar a otro administrador.',
      'CHAT_GROUP_CREATOR_REQUIRED',
      403
    );
  }

  return {
    participantesIds: state.participantesIds.filter((id) => id !== targetId),
    administradoresIds: state.administradoresIds.filter((id) => id !== targetId),
    targetId,
  };
};

export const transferChatGroupOwnership = ({ conversation, actorIdMiembros, targetIdMiembros }) => {
  assertChatGroupCreator(conversation, actorIdMiembros);
  const state = getChatGroupState(conversation);
  const targetId = memberId(targetIdMiembros);

  if (!targetId || !state.participantesIds.includes(targetId) || targetId === state.creadoPorIdMiembros) {
    throw new ChatGroupError('Selecciona otro participante válido para transferir la propiedad.');
  }

  return {
    creadoPorIdMiembros: targetId,
    administradoresIds: uniqueMemberIds([
      ...state.administradoresIds,
      state.creadoPorIdMiembros,
      targetId,
    ]),
  };
};

export const updateChatGroupAdministrator = ({
  conversation,
  actorIdMiembros,
  targetIdMiembros,
  makeAdmin,
}) => {
  assertChatGroupCreator(conversation, actorIdMiembros);
  const state = getChatGroupState(conversation);
  const targetId = memberId(targetIdMiembros);

  if (!targetId || !state.participantesIds.includes(targetId)) {
    throw new ChatGroupError('El participante indicado no pertenece al grupo.');
  }
  if (!makeAdmin && targetId === state.creadoPorIdMiembros) {
    throw new ChatGroupError('El creador siempre debe conservar la administración.');
  }

  return {
    administradoresIds: makeAdmin
      ? uniqueMemberIds([...state.administradoresIds, targetId])
      : state.administradoresIds.filter((id) => id !== targetId),
  };
};

export const updateChatGroupDetails = ({ conversation, actorIdMiembros, name, avatarUrl }) => {
  assertChatGroupAdmin(conversation, actorIdMiembros);
  const normalizedName = String(name ?? conversation.nombreGrupo ?? '').trim();
  const normalizedAvatar = String(avatarUrl ?? conversation.avatarGrupoUrl ?? '').trim();

  if (normalizedName.length < 2 || normalizedName.length > 80) {
    throw new ChatGroupError('El nombre del grupo debe tener entre 2 y 80 caracteres.');
  }
  if (normalizedAvatar) {
    let parsed;
    try {
      parsed = new URL(normalizedAvatar);
    } catch {
      throw new ChatGroupError('El avatar del grupo debe usar una URL HTTPS válida.');
    }
    if (parsed.protocol !== 'https:') {
      throw new ChatGroupError('El avatar del grupo debe usar una URL HTTPS válida.');
    }
  }

  return { nombreGrupo: normalizedName, avatarGrupoUrl: normalizedAvatar || null };
};
