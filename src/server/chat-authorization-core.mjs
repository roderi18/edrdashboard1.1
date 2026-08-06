export const CHAT_PERMISSIONS = Object.freeze({
  VIEW: 'chats.ver',
  START: 'chats.iniciar',
  SEND: 'chats.enviar',
  REACT: 'chats.reaccionar',
  EDIT_OWN: 'chats.editar_propios',
  DELETE_OWN: 'chats.eliminar_propios',
  MANAGE_GROUP: 'chats.gestionar_grupo',
  CLEAR: 'chats.limpiar',
  REPORT: 'chats.reportar',
});

export const CHAT_AUTHORIZATION_CODES = Object.freeze({
  PERMISSION_DENIED: 'CHAT_PERMISSION_DENIED',
  NOT_PARTICIPANT: 'CHAT_NOT_PARTICIPANT',
  NOT_CREATOR: 'CHAT_NOT_CREATOR',
  NOT_MESSAGE_AUTHOR: 'CHAT_NOT_MESSAGE_AUTHOR',
});

export class ChatAuthorizationError extends Error {
  constructor(message, { code = CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED } = {}) {
    super(message);
    this.name = 'ChatAuthorizationError';
    this.status = 403;
    this.code = code;
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeMemberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const getPermissionLists = (actor = {}) => {
  const profile = actor.profile ?? {};
  const claims = actor.claims ?? {};

  return {
    granted: [
      ...asArray(profile.permisosRol),
      ...asArray(profile.permisosDirectos),
      ...asArray(profile.permisosAutorizacion),
      ...(Array.isArray(profile.permisos) ? profile.permisos : []),
      ...asArray(claims.permisos),
    ].map(String),
    excluded: [
      ...asArray(profile.permisosExcluidos),
      ...asArray(profile.excludedPermissions),
      ...asArray(claims.permisosExcluidos),
    ].map(String),
  };
};

const getModulePermissions = (actor = {}) => {
  const permissions = actor.profile?.permisos;

  if (!permissions || Array.isArray(permissions) || typeof permissions !== 'object') return {};

  return permissions.chats && typeof permissions.chats === 'object' ? permissions.chats : {};
};

const PERMISSION_ACTION_KEYS = Object.freeze({
  [CHAT_PERMISSIONS.VIEW]: ['ver'],
  [CHAT_PERMISSIONS.START]: ['iniciar'],
  [CHAT_PERMISSIONS.SEND]: ['enviar'],
  [CHAT_PERMISSIONS.REACT]: ['reaccionar'],
  [CHAT_PERMISSIONS.EDIT_OWN]: ['editarPropios', 'editar_propios'],
  [CHAT_PERMISSIONS.DELETE_OWN]: ['eliminarPropios', 'eliminar_propios'],
  [CHAT_PERMISSIONS.MANAGE_GROUP]: ['gestionarGrupo', 'gestionar_grupo'],
  [CHAT_PERMISSIONS.CLEAR]: ['limpiar'],
  [CHAT_PERMISSIONS.REPORT]: ['reportar'],
});

export const assertChatPermission = (actor = {}, permission = CHAT_PERMISSIONS.VIEW) => {
  const { granted, excluded } = getPermissionLists(actor);
  const modulePermissions = getModulePermissions(actor);
  const actionKeys = PERMISSION_ACTION_KEYS[permission] ?? [];
  const explicitlyDenied =
    excluded.includes(permission) ||
    modulePermissions.ver === false ||
    actionKeys.some((actionKey) => modulePermissions[actionKey] === false);

  if (explicitlyDenied) {
    throw new ChatAuthorizationError('No tienes permiso para realizar esta acción en el chat.', {
      code: CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED,
    });
  }

  // Compatibilidad: chats.ver era históricamente un permiso de módulo booleano.
  // Los permisos granulares actúan como overrides explícitos sin bloquear perfiles
  // antiguos que aún no han sido migrados al nuevo catálogo.
  const declaredGranularPermissions = [...granted, ...excluded].filter((item) =>
    item.startsWith('chats.')
  );

  if (
    declaredGranularPermissions.length &&
    permission !== CHAT_PERMISSIONS.VIEW &&
    !granted.includes(permission) &&
    !granted.includes('chats.administrar') &&
    !actionKeys.some((actionKey) => modulePermissions[actionKey] === true)
  ) {
    throw new ChatAuthorizationError('No tienes permiso para realizar esta acción en el chat.', {
      code: CHAT_AUTHORIZATION_CODES.PERMISSION_DENIED,
    });
  }

  return true;
};

export const assertConversationParticipant = (conversation = {}, actor = {}) => {
  const actorId = normalizeMemberId(actor.idMiembros);
  const participantIds = asArray(conversation.participantesIds).map(normalizeMemberId);

  if (!actorId || !participantIds.includes(actorId)) {
    throw new ChatAuthorizationError('No tienes acceso a esta conversación.', {
      code: CHAT_AUTHORIZATION_CODES.NOT_PARTICIPANT,
    });
  }

  return actorId;
};

export const assertConversationCreator = (conversation = {}, actor = {}) => {
  const actorId = assertConversationParticipant(conversation, actor);

  if (normalizeMemberId(conversation.creadoPorIdMiembros) !== actorId) {
    throw new ChatAuthorizationError('Solo el creador puede administrar esta conversación.', {
      code: CHAT_AUTHORIZATION_CODES.NOT_CREATOR,
    });
  }

  return actorId;
};

export const assertMessageAuthor = (message = {}, actor = {}) => {
  const actorId = normalizeMemberId(actor.idMiembros);
  const senderId = normalizeMemberId(message.remitenteIdMiembros ?? message.senderId);

  if (!actorId || senderId !== actorId) {
    throw new ChatAuthorizationError('Solo puedes modificar tus propios mensajes.', {
      code: CHAT_AUTHORIZATION_CODES.NOT_MESSAGE_AUTHOR,
    });
  }

  return actorId;
};

export const authorizeConversationOperation = ({
  actor,
  conversation,
  permission = CHAT_PERMISSIONS.VIEW,
  creatorOnly = false,
} = {}) => {
  assertChatPermission(actor, permission);

  return creatorOnly
    ? assertConversationCreator(conversation, actor)
    : assertConversationParticipant(conversation, actor);
};
