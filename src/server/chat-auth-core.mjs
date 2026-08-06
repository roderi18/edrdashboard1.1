export const CHAT_AUTH_CODES = Object.freeze({
  SERVER_NOT_CONFIGURED: 'CHAT_AUTH_SERVER_NOT_CONFIGURED',
  MISSING_TOKEN: 'CHAT_AUTH_MISSING_TOKEN',
  INVALID_TOKEN: 'CHAT_AUTH_INVALID_TOKEN',
  IDENTITY_LOOKUP_FAILED: 'CHAT_AUTH_IDENTITY_LOOKUP_FAILED',
  MEMBER_NOT_LINKED: 'CHAT_AUTH_MEMBER_NOT_LINKED',
  MEMBER_INACTIVE: 'CHAT_AUTH_MEMBER_INACTIVE',
  MEMBER_ID_CONFLICT: 'CHAT_AUTH_MEMBER_ID_CONFLICT',
  MEMBER_NOT_PARTICIPANT: 'CHAT_AUTH_MEMBER_NOT_PARTICIPANT',
});

export class ChatAuthenticationError extends Error {
  constructor(message, { status = 401, code = CHAT_AUTH_CODES.INVALID_TOKEN, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ChatAuthenticationError';
    this.status = status;
    this.code = code;
  }
}

const normalizeMemberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const INACTIVE_PROFILE_STATES = new Set([
  'inactivo',
  'inactive',
  'bloqueado',
  'blocked',
  'deshabilitado',
  'disabled',
  'suspendido',
  'suspended',
]);

const isInactiveProfile = (profile = {}) => {
  if (profile.activo === false || profile.active === false || profile.habilitado === false) {
    return true;
  }

  return [profile.estado, profile.estatus, profile.status]
    .map(normalizeText)
    .filter(Boolean)
    .some((status) => INACTIVE_PROFILE_STATES.has(status));
};

const getProfileMemberId = (profile = {}) =>
  normalizeMemberId(profile.idMiembros ?? profile.memberId);

export const extractBearerToken = (headers) => {
  const authorization =
    typeof headers?.get === 'function'
      ? headers.get('authorization') || headers.get('Authorization') || ''
      : headers?.authorization || headers?.Authorization || '';
  const match = String(authorization).match(/^Bearer\s+([^\s].*)$/i);

  return match ? match[1].trim() : '';
};

export const resolveAuthenticatedMember = ({ decodedToken = {}, profiles = [] } = {}) => {
  const linkedProfiles = Array.isArray(profiles) ? profiles.filter(Boolean) : [];

  if (linkedProfiles.some(isInactiveProfile)) {
    throw new ChatAuthenticationError('El miembro vinculado a la sesión está inactivo.', {
      status: 403,
      code: CHAT_AUTH_CODES.MEMBER_INACTIVE,
    });
  }

  const tokenMemberId = normalizeMemberId(decodedToken.idMiembros);
  const profileMemberIds = linkedProfiles.map(getProfileMemberId).filter(Boolean);
  const memberIds = [...new Set([tokenMemberId, ...profileMemberIds].filter(Boolean))];

  if (memberIds.length > 1) {
    throw new ChatAuthenticationError(
      'La sesión tiene vínculos contradictorios con más de un miembro.',
      { status: 403, code: CHAT_AUTH_CODES.MEMBER_ID_CONFLICT }
    );
  }

  if (!memberIds.length) {
    throw new ChatAuthenticationError(
      'La cuenta autenticada no está vinculada a un miembro válido.',
      { status: 403, code: CHAT_AUTH_CODES.MEMBER_NOT_LINKED }
    );
  }

  const idMiembros = memberIds[0];
  const profile =
    linkedProfiles.find((candidate) => getProfileMemberId(candidate) === idMiembros) ?? null;

  return { idMiembros, profile };
};

export const createChatRequestAuthenticator = ({
  isConfigured,
  verifyIdToken,
  loadIdentityProfiles,
} = {}) => {
  if (
    typeof isConfigured !== 'function' ||
    typeof verifyIdToken !== 'function' ||
    typeof loadIdentityProfiles !== 'function'
  ) {
    throw new TypeError('La autenticación de chat requiere dependencias válidas.');
  }

  return async (request) => {
    if (!isConfigured()) {
      throw new ChatAuthenticationError(
        'El servidor no tiene configurada la autenticación Firebase Admin.',
        { status: 503, code: CHAT_AUTH_CODES.SERVER_NOT_CONFIGURED }
      );
    }

    const token = extractBearerToken(request?.headers);

    if (!token) {
      throw new ChatAuthenticationError('Falta el token Bearer de autorización.', {
        status: 401,
        code: CHAT_AUTH_CODES.MISSING_TOKEN,
      });
    }

    let decodedToken;

    try {
      decodedToken = await verifyIdToken(token);
    } catch (error) {
      if (error instanceof ChatAuthenticationError) throw error;

      throw new ChatAuthenticationError('El token Firebase es inválido, expiró o fue revocado.', {
        status: 401,
        code: CHAT_AUTH_CODES.INVALID_TOKEN,
        cause: error,
      });
    }

    const uid = String(decodedToken?.uid ?? '').trim();

    if (!uid) {
      throw new ChatAuthenticationError('El token Firebase no contiene una identidad válida.', {
        status: 401,
        code: CHAT_AUTH_CODES.INVALID_TOKEN,
      });
    }

    let profiles;

    try {
      profiles = await loadIdentityProfiles({
        uid,
        email: normalizeText(decodedToken.email),
        decodedToken,
        token,
      });
    } catch (error) {
      throw new ChatAuthenticationError(
        'No se pudo comprobar el vínculo de la cuenta con el miembro.',
        { status: 503, code: CHAT_AUTH_CODES.IDENTITY_LOOKUP_FAILED, cause: error }
      );
    }

    const { idMiembros, profile } = resolveAuthenticatedMember({ decodedToken, profiles });

    return {
      uid,
      email: normalizeText(decodedToken.email ?? profile?.correo ?? profile?.email),
      idMiembros,
      profile,
      claims: decodedToken,
      token,
    };
  };
};

const assertAuthenticatedActor = (actor = {}) => {
  const idMiembros = normalizeMemberId(actor.idMiembros);

  if (!idMiembros) {
    throw new ChatAuthenticationError('No se pudo identificar al miembro autenticado.', {
      status: 403,
      code: CHAT_AUTH_CODES.MEMBER_NOT_LINKED,
    });
  }

  return idMiembros;
};

export const bindAuthenticatedMessage = (message = {}, actor = {}) => {
  const idMiembros = assertAuthenticatedActor(actor);

  return {
    ...(message && typeof message === 'object' ? message : {}),
    senderId: idMiembros,
    remitenteIdMiembros: idMiembros,
  };
};

export const bindAuthenticatedConversation = (conversation = {}, actor = {}) => {
  const idMiembros = assertAuthenticatedActor(actor);
  const safeConversation = conversation && typeof conversation === 'object' ? conversation : {};
  const messages = Array.isArray(safeConversation.messages)
    ? safeConversation.messages.map((message, index) =>
        index === 0 ? bindAuthenticatedMessage(message, actor) : message
      )
    : safeConversation.messages;

  return {
    ...safeConversation,
    creadoPorIdMiembros: idMiembros,
    ...(messages ? { messages } : {}),
  };
};

export const assertAuthenticatedConversationParticipant = (participantIds = [], actor = {}) => {
  const idMiembros = assertAuthenticatedActor(actor);
  const isParticipant = participantIds.some(
    (participantId) => normalizeMemberId(participantId) === idMiembros
  );

  if (!isParticipant) {
    throw new ChatAuthenticationError(
      'El miembro autenticado debe formar parte de la conversación que crea.',
      { status: 403, code: CHAT_AUTH_CODES.MEMBER_NOT_PARTICIPANT }
    );
  }

  return idMiembros;
};
