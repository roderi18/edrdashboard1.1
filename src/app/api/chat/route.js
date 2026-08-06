import {
  doc,
  query,
  where,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { deleteChatStorageObjects } from 'src/server/chat-storage-rest.mjs';
import { resolverNotificacionConConfiguracion } from 'src/services/notification-service';
import { toPublicChatContact, getPublicChatContacts } from 'src/server/chat-contact-core.mjs';
import {
  buildChatReceipt,
  applyChatReceiptsToMessages,
} from 'src/server/chat-receipts.mjs';
import {
  ChatFirestoreRestError,
  createChatFirestoreRestClient,
} from 'src/server/chat-firestore-rest.mjs';
import {
  chatMessageToUi,
  normalizeChatReaction,
  createChatMessageDocument,
  ChatMessageValidationError,
} from 'src/server/chat-message-model.mjs';
import {
  createChatAuditEvent,
  getPersonalClearCutoff,
  collectChatAttachmentPaths,
  applyChatMessageLifecycleAction,
} from 'src/server/chat-message-lifecycle.mjs';
import {
  authenticateChatRequest,
  bindAuthenticatedMessage,
  bindAuthenticatedConversation,
  chatAuthenticationErrorResponse,
  assertAuthenticatedConversationParticipant,
} from 'src/server/chat-auth';
import {
  CHAT_PERMISSIONS,
  assertMessageAuthor,
  assertChatPermission,
  ChatAuthorizationError,
  assertConversationParticipant,
  authorizeConversationOperation,
} from 'src/server/chat-authorization-core.mjs';
import {
  ChatGroupError,
  getChatGroupRole,
  assertChatGroupAdmin,
  updateChatGroupDetails,
  assertChatGroupCreator,
  validateChatGroupRemoval,
  transferChatGroupOwnership,
  updateChatGroupAdministrator,
} from 'src/server/chat-group-core.mjs';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES = 'mensajes';
const COLECCIONES_USUARIOS = ['users', 'usuarios_roles', 'admins'];
const MEMBERS_API_URL = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';
const COLECCION_FOTOS = 'fotos';

const chatAuthorizationErrorResponse = (error) => {
  if (!(error instanceof ChatAuthorizationError)) return null;

  return Response.json({ message: error.message, code: error.code }, { status: error.status });
};

const chatFirestoreErrorResponse = (error) => {
  if (!(error instanceof ChatFirestoreRestError)) return null;

  const status = error.status === 401 ? 401 : error.status === 403 ? 403 : 503;

  return Response.json({ message: error.message, code: error.code }, { status });
};

const chatMessageValidationErrorResponse = (error) => {
  if (!(error instanceof ChatMessageValidationError)) return null;

  return Response.json({ message: error.message, code: error.code }, { status: error.status });
};

const chatGroupErrorResponse = (error) => {
  if (!(error instanceof ChatGroupError)) return null;

  return Response.json({ message: error.message, code: error.code }, { status: error.status });
};

const createChatStore = (chatActor = {}) =>
  createChatFirestoreRestClient({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    token: chatActor.token,
  });

const nowIso = () => new Date().toISOString();

const toNumberOrNull = (value) => {
  const number = Number(value);

  return Number.isFinite(number) && number !== 0 ? number : null;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const normalizeLookupKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const buildNombreCompleto = (member = {}) =>
  [member.nombres, member.apellidos].filter(Boolean).join(' ').trim() ||
  member.nombre ||
  member.name ||
  member.displayName ||
  member.codigoMiembro ||
  `Miembro ${member.idMiembros ?? member.id ?? ''}`.trim();

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const guardarNotificacionConfigurada = async (notificacion) => {
  const notificacionConfigurada = await resolverNotificacionConConfiguracion(notificacion);

  if (!notificacionConfigurada) {
    return null;
  }

  await setDoc(
    doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificacionConfigurada.id),
    notificacionConfigurada
  );

  return notificacionConfigurada;
};

const normalizeMember = (member = {}) => {
  const idMiembros = toNumberOrNull(member.idMiembros ?? member.id ?? member.memberId);

  return {
    idMiembros,
    codigoMiembro: member.codigoMiembro ?? member.memberId ?? '',
    nombres: member.nombres ?? member.firstName ?? member.nombre ?? '',
    apellidos: member.apellidos ?? member.lastName ?? '',
    genero: member.genero ?? member.gender ?? '',
    fechaNacimiento: member.fechaNacimiento ?? member.birthDate ?? null,
    idDestacamento: toNumberOrNull(member.idDestacamento ?? member.destId),
    telefono: member.telefono ?? member.phoneNumber ?? '',
    direccion: member.direccion ?? member.address ?? member.memberAddress ?? '',
    correo: member.correo ?? member.email ?? '',
    idDivision: toNumberOrNull(member.idDivision),
    instructorCertificadoCi: Boolean(member.instructorCertificadoCi),
    estatusVigenciaCi: Boolean(member.estatusVigenciaCi),
    fechaInicioCertificado: member.fechaInicioCertificado ?? null,
    fechaFinCertificado: member.fechaFinCertificado ?? null,
    estatusMiembro: member.estatusMiembro ?? member.status ?? 'activo',
    avatarUrl: member.avatarUrl ?? member.photoURL ?? '',
  };
};

const memberToContact = (member = {}) => {
  const normalizedMember = normalizeMember(member);

  return toPublicChatContact(normalizedMember);
};

const getAllContacts = (members = []) =>
  getPublicChatContacts(members.map((member) => normalizeMember(member)));

const getMemberLookupKeys = (member = {}) =>
  [
    member.idMiembros,
    member.id,
    member.codigoMiembro,
    member.memberId,
    member.codigoUsuario,
    member.correo,
    member.email,
    member.uid,
  ]
    .map(normalizeLookupKey)
    .filter(Boolean);

const resolveParticipantFromContacts = (participant = {}, contacts = []) => {
  const participantKeys = new Set(getMemberLookupKeys(participant));

  if (!participantKeys.size) {
    return null;
  }

  const contact = contacts.find((item) =>
    getMemberLookupKeys(item).some((key) => participantKeys.has(key))
  );

  return contact ? normalizeMember(contact) : null;
};

async function resolveConversationParticipants(conversationData = {}) {
  const rawParticipants = asArray(conversationData.participantes ?? conversationData.participants);

  const [members, firestoreProfiles] = await Promise.all([
    getMembersFromApi().catch(() => []),
    getMembersFromFirestoreProfiles().catch(() => []),
  ]);
  const contacts = getAllContacts([...members, ...firestoreProfiles]);

  return rawParticipants
    .map((participant) => resolveParticipantFromContacts(participant, contacts))
    .filter((member) => member?.idMiembros)
    .map(toPublicChatContact);
}

const messageToFirestore = (message = {}, fallbackSender = {}, conversationId) =>
  createChatMessageDocument({ message, fallbackSender, conversationId });

const resolveMessageSender = ({ messageData = {}, conversation = {} }) => {
  const participants = asArray(conversation.participantes);
  const participantIds = asArray(conversation.participantesIds);
  const senderId = messageData.remitenteIdMiembros ?? messageData.senderId;
  const directMatch = participants.find(
    (participant) => Number(participant.idMiembros) === Number(senderId)
  );

  if (directMatch) return directMatch;

  const normalizedSender = String(senderId ?? '')
    .trim()
    .toLowerCase();

  return (
    participants.find((participant) =>
      [
        participant.codigoMiembro,
        participant.correo,
        participant.email,
        participant.uid,
        participant.id,
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
        .includes(normalizedSender)
    ) ||
    participants.find((participant) => participant.idMiembros) ||
    (participantIds[0] ? { idMiembros: participantIds[0] } : null)
  );
};

const messageToUi = (message = {}) => chatMessageToUi(message);

const contactWithCurrentPhoto = async (member = {}) => {
  const contact = memberToContact(member);
  const avatarUrl = await getMemberPhotoUrl(contact.idMiembros, contact.avatarUrl);

  return {
    ...contact,
    avatarUrl,
  };
};

const conversationToUi = async (
  conversation = {},
  messages = null,
  viewerIdMiembros = null,
  chatStore,
  { includeReceipts = true } = {}
) => {
  const visibilityCutoff = getPersonalClearCutoff(conversation, viewerIdMiembros);
  const loadedMessages =
    messages ??
    (
      await getMessages(
        conversation.idConversacion ?? conversation.id,
        { afterEnviadoEn: visibilityCutoff },
        chatStore
      )
    ).map((message) => messageToUi(message));
  const receipts =
    includeReceipts && chatStore
      ? await getConversationReceipts(conversation.idConversacion ?? conversation.id, chatStore)
      : [];
  const messagesWithReceipts = includeReceipts
    ? applyChatReceiptsToMessages({
        messages: loadedMessages,
        participantIds: asArray(conversation.participantesIds),
        receipts,
      })
    : loadedMessages;
  const viewerUnreadCount =
    viewerIdMiembros && conversation.noLeidosPorIdMiembros
      ? Number(conversation.noLeidosPorIdMiembros[String(viewerIdMiembros)] || 0)
      : null;

  return {
    id: String(conversation.idConversacion ?? conversation.id ?? ''),
    type:
      conversation.tipoConversacion === 'GRUPAL' || conversation.type === 'GROUP'
        ? 'GROUP'
        : 'ONE_TO_ONE',
    groupName: conversation.nombreGrupo || null,
    groupAvatarUrl: conversation.avatarGrupoUrl || null,
    creatorIdMiembros: conversation.creadoPorIdMiembros ?? null,
    canClearGlobally:
      !!viewerIdMiembros &&
      Number(conversation.creadoPorIdMiembros) === Number(viewerIdMiembros),
    administratorIds: asArray(conversation.administradoresIds),
    currentUserGroupRole:
      conversation.tipoConversacion === 'GRUPAL' && viewerIdMiembros
        ? getChatGroupRole(conversation, viewerIdMiembros)
        : null,
    createdAt: conversation.creadoEn ?? conversation.createdAt ?? null,
    updatedAt:
      conversation.actualizadoEn ??
      conversation.updatedAt ??
      conversation.creadoEn ??
      conversation.createdAt ??
      null,
    participants: await Promise.all(
      asArray(conversation.participantes).map(contactWithCurrentPhoto)
    ),
    messages: messagesWithReceipts,
    deliveryReceipts: receipts,
    muted:
      !!viewerIdMiembros &&
      Boolean(conversation.silenciadoPorIdMiembros?.[String(viewerIdMiembros)]),
    unreadCount:
      viewerUnreadCount ??
      Object.values(conversation.noLeidosPorIdMiembros ?? {}).reduce(
        (total, count) => total + Number(count || 0),
        0
      ),
  };
};

const ensureFirestore = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado para usar Firestore.');
  }
};

async function getMembersFromApi() {
  const response = await fetch(MEMBERS_API_URL, { cache: 'no-store' });
  const payload = await response.json();
  const normalized = normalizeApiResponse(payload);

  return asArray(normalized.data)
    .map(normalizeMember)
    .filter((member) => member.idMiembros);
}

async function getMembersFromFirestoreProfiles() {
  const snapshots = await Promise.all(
    COLECCIONES_USUARIOS.map((collectionName) =>
      getDocs(collection(FIRESTORE, collectionName)).catch(() => ({ docs: [] }))
    )
  );

  return snapshots
    .flatMap((snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    .map((profile) =>
      normalizeMember({
        ...profile,
        nombres: profile.nombres ?? profile.nombre ?? profile.displayName,
        apellidos: profile.apellidos ?? '',
        correo: profile.correo ?? profile.email,
        telefono: profile.telefono ?? profile.phoneNumber,
        direccion: profile.direccion ?? profile.address,
        estatusMiembro: profile.estatusMiembro ?? profile.estado ?? profile.status ?? profile.rol,
        avatarUrl: profile.avatarUrl ?? profile.photoURL,
      })
    )
    .filter((member) => member.idMiembros);
}

async function getNotificationProfilesByMemberIds(idMiembrosList = []) {
  const targetIds = new Set(idMiembrosList.map((idMiembros) => Number(idMiembros)).filter(Boolean));

  if (!targetIds.size) {
    return [];
  }

  const snapshots = await Promise.all(
    COLECCIONES_USUARIOS.map((collectionName) =>
      getDocs(collection(FIRESTORE, collectionName)).catch(() => ({ docs: [], collectionName }))
    )
  );

  return snapshots.flatMap((snapshot, index) => {
    const collectionName = COLECCIONES_USUARIOS[index];

    return snapshot.docs
      .map((item) => {
        const profile = item.data() ?? {};
        const idMiembros = toNumberOrNull(profile.idMiembros ?? profile.memberId);

        if (!targetIds.has(Number(idMiembros))) {
          return null;
        }

        const role = String(profile.rol ?? profile.role ?? '').toLowerCase();
        const isAdmin = collectionName === 'admins' || role === 'admin' || role === 'administrador';

        return {
          idMiembros,
          uid: String(profile.uid ?? profile.idUsuario ?? item.id ?? '').trim(),
          rolDestinatario: isAdmin ? 'admin' : 'usuario',
        };
      })
      .filter((profile) => profile?.uid);
  });
}

async function getMemberPhotoUrl(idMiembros, fallbackUrl = '') {
  if (fallbackUrl) {
    return fallbackUrl;
  }

  const memberId = toNumberOrNull(idMiembros);

  if (!memberId) {
    return '';
  }

  const snapshot = await getDoc(
    doc(FIRESTORE, COLECCION_FOTOS, `miembro_${memberId}_perfil`)
  ).catch(() => null);

  if (!snapshot?.exists()) {
    return '';
  }

  const photo = snapshot.data() ?? {};

  if (photo.estado === 'activo' && photo.urlFoto) {
    return photo.urlFoto;
  }

  const profileSnapshots = await Promise.all(
    COLECCIONES_USUARIOS.map((collectionName) =>
      getDocs(
        query(collection(FIRESTORE, collectionName), where('idMiembros', '==', memberId))
      ).catch(() => ({ docs: [] }))
    )
  );

  const profileWithPhoto = profileSnapshots
    .flatMap((profileSnapshot) => profileSnapshot.docs.map((item) => item.data() ?? {}))
    .find((profile) => profile.photoURL || profile.avatarUrl || profile.urlFoto);

  return (
    profileWithPhoto?.photoURL || profileWithPhoto?.avatarUrl || profileWithPhoto?.urlFoto || ''
  );
}

async function createMessageNotifications({ conversation = {}, message = {} }) {
  if (!message.texto) return;

  const senderId = Number(message.remitenteIdMiembros);
  const mutedByIdMiembros = conversation.silenciadoPorIdMiembros ?? {};
  const recipientsIds = asArray(conversation.participantesIds).filter(
    (idMiembros) => Number(idMiembros) !== senderId && !mutedByIdMiembros[String(idMiembros)]
  );

  if (!recipientsIds.length) return;

  const sender =
    asArray(conversation.participantes).find(
      (participant) => Number(participant.idMiembros) === senderId
    ) ?? message.remitente;
  const senderName = buildNombreCompleto(sender);
  const senderPhotoUrl = await getMemberPhotoUrl(senderId, sender?.avatarUrl);
  const recipientProfiles = await getNotificationProfilesByMemberIds(recipientsIds);

  await Promise.all(
    recipientProfiles.map((profile) => {
      const notificationId = `mensaje_recibido_${conversation.idConversacion || conversation.id}_${message.idMensaje}_${profile.uid}`;

      return guardarNotificacionConfigurada({
        id: notificationId,
        tipoNotificacion: 'mensaje_recibido',
        modulo: 'mensajes',
        titulo: 'Mensaje recibido',
        tituloHtml: `<p><strong>${escapeHtml(senderName)}</strong> te envió un mensaje</p>`,
        mensaje: 'te envió un mensaje.',
        mensajeVisual: 'te envió un mensaje.',
        rolDestinatario: profile.rolDestinatario,
        idsDestinatarios: [profile.uid],
        prioridad: 'informativa',
        estado: 'no_leida',
        fechaCreacion: message.enviadoEn ?? nowIso(),
        fechaEnvio: message.enviadoEn ?? nowIso(),
        actorId: String(senderId || ''),
        actorTipo: 'usuario',
        actorNombre: senderName,
        actorFotoURL: senderPhotoUrl || null,
        entidadTipo: 'mensaje',
        entidadId: message.idMensaje,
        ruta: `/dashboard/chat?id=${conversation.idConversacion || conversation.id}`,
        imagenTipo: 'persona',
        imagenURL: senderPhotoUrl || null,
        miniaturaURL: senderPhotoUrl || null,
        tipoAccion: 'responder',
        etiquetaAccion: 'Responder',
        tipoAccionSecundaria: null,
        etiquetaAccionSecundaria: null,
        leidaPor: [],
        fechaProgramada: null,
        fechaExpiracion: null,
        fechaLectura: null,
        metadatos: {
          idMensaje: message.idMensaje,
          idConversacion: conversation.idConversacion || conversation.id,
          remitenteIdMiembros: senderId,
          destinatarioIdMiembros: profile.idMiembros,
          texto: message.texto,
        },
        creadoEnServidor: serverTimestamp(),
        actualizadoEnServidor: serverTimestamp(),
      });
    })
  );
}

async function getAdminNotificationProfiles() {
  const snapshots = await Promise.all(
    COLECCIONES_USUARIOS.map((collectionName) =>
      getDocs(collection(FIRESTORE, collectionName)).catch(() => ({ docs: [], collectionName }))
    )
  );

  return snapshots.flatMap((snapshot, index) => {
    const collectionName = COLECCIONES_USUARIOS[index];

    return snapshot.docs
      .map((item) => {
        const profile = item.data() ?? {};
        const role = String(profile.rol ?? profile.role ?? '').toLowerCase();
        const isAdmin = collectionName === 'admins' || role === 'admin' || role === 'administrador';

        if (!isAdmin) {
          return null;
        }

        return {
          uid: String(profile.uid ?? profile.idUsuario ?? item.id ?? '').trim(),
          idMiembros: toNumberOrNull(profile.idMiembros ?? profile.memberId),
        };
      })
      .filter((profile) => profile?.uid);
  });
}

const DEFAULT_MESSAGES_PAGE_SIZE = 30;

async function getMessages(
  idConversacion,
  { pageLimit, beforeEnviadoEn, afterEnviadoEn } = {},
  chatStore
) {
  if (!idConversacion) return [];

  const messages = await chatStore.runQuery({
    parentPath: `${COLECCION_CONVERSACIONES}/${idConversacion}`,
    collectionId: SUBCOLECCION_MENSAJES,
    filters: [
      ...(beforeEnviadoEn ? [{ field: 'enviadoEn', op: '<', value: beforeEnviadoEn }] : []),
      ...(afterEnviadoEn ? [{ field: 'enviadoEn', op: '>', value: afterEnviadoEn }] : []),
    ],
    orderBy: [{ field: 'enviadoEn', direction: 'desc' }],
    limit: pageLimit || DEFAULT_MESSAGES_PAGE_SIZE,
  });

  return messages.reverse();
}

async function getAllMessages(idConversacion, chatStore) {
  if (!idConversacion) return [];

  return chatStore.runQuery({
    parentPath: `${COLECCION_CONVERSACIONES}/${idConversacion}`,
    collectionId: SUBCOLECCION_MENSAJES,
    orderBy: [{ field: 'enviadoEn', direction: 'asc' }],
  });
}

async function getConversationReceipts(idConversacion, chatStore) {
  if (!idConversacion) return [];

  return chatStore.runQuery({
    parentPath: `${COLECCION_CONVERSACIONES}/${idConversacion}`,
    collectionId: 'recibos',
  });
}

async function updateConversationReceipt({
  conversationId,
  conversation,
  chatActor,
  chatStore,
  markRead = false,
  persist = true,
}) {
  const viewerId = authorizeConversationOperation({
    actor: chatActor,
    conversation,
    permission: CHAT_PERMISSIONS.VIEW,
  });
  const deliveredUntil =
    conversation.ultimoMensaje?.enviadoEn ?? conversation.actualizadoEn ?? null;

  if (!deliveredUntil) return null;

  const receiptPath = `${COLECCION_CONVERSACIONES}/${conversationId}/recibos/${chatActor.uid}`;
  const existingReceipt = (await chatStore.getDocument(receiptPath)) ?? {};
  const receipt = buildChatReceipt({
    existing: existingReceipt,
    idMiembros: viewerId,
    deliveredUntil,
    readUntil: markRead ? deliveredUntil : null,
    now: nowIso(),
  });

  if (persist) {
    await chatStore.setDocument(receiptPath, receipt);
  }

  return { path: receiptPath, data: receipt };
}

function buildConversationId({ tipoConversacion, participantesIds, providedId }) {
  if (tipoConversacion === 'GRUPAL') {
    return providedId && !/^\d+$/.test(String(providedId))
      ? String(providedId)
      : `grupal_${crypto.randomUUID()}`;
  }

  const ids = [...new Set(participantesIds.map((id) => Number(id)).filter(Boolean))].sort(
    (a, b) => a - b
  );

  return ids.length >= 2 ? `individual_${ids.join('_')}` : String(providedId || ids[0] || '');
}

async function getConversationDoc(idConversacion, chatStore) {
  return chatStore.getDocument(`${COLECCION_CONVERSACIONES}/${idConversacion}`);
}

async function getConversations(viewerIdMiembros = null, chatStore) {
  const viewerId = toNumberOrNull(viewerIdMiembros);
  const conversations = await chatStore.runQuery({
    collectionId: COLECCION_CONVERSACIONES,
    filters: [
      { field: 'eliminada', op: '==', value: false },
      ...(viewerId ? [{ field: 'participantesIds', op: 'array-contains', value: viewerId }] : []),
    ],
  });

  return Promise.all(
    conversations.map(async (conversation) =>
      conversationToUi(conversation, null, viewerId, chatStore, { includeReceipts: false })
    )
  );
}

async function getUnreadSummary(viewerIdMiembros, chatStore) {
  const viewerId = toNumberOrNull(viewerIdMiembros);

  if (!viewerId) {
    return {
      unreadByConversation: {},
      unreadConversationCount: 0,
      unreadMessageCount: 0,
    };
  }

  const conversations = await chatStore.runQuery({
    collectionId: COLECCION_CONVERSACIONES,
    filters: [
      { field: 'eliminada', op: '==', value: false },
      { field: 'participantesIds', op: 'array-contains', value: viewerId },
    ],
  });
  const unreadByConversation = {};

  conversations.forEach((conversation) => {
    const unreadCount = Number(conversation.noLeidosPorIdMiembros?.[String(viewerId)] ?? 0);

    if (unreadCount > 0) {
      unreadByConversation[conversation.id] = unreadCount;
    }
  });

  return {
    unreadByConversation,
    unreadConversationCount: Object.keys(unreadByConversation).length,
    unreadMessageCount: Object.values(unreadByConversation).reduce(
      (total, count) => total + Number(count || 0),
      0
    ),
  };
}

async function createConversation(conversationData = {}, chatActor = {}, chatStore) {
  assertChatPermission(chatActor, CHAT_PERMISSIONS.START);

  const authenticatedConversationData = bindAuthenticatedConversation(conversationData, chatActor);
  const participantes = await resolveConversationParticipants(authenticatedConversationData);
  const participantesIds = [...new Set(participantes.map((member) => member.idMiembros))];
  const actorIdMiembros = assertAuthenticatedConversationParticipant(participantesIds, chatActor);
  const tipoConversacion =
    authenticatedConversationData.tipoConversacion ??
    (authenticatedConversationData.type === 'GROUP' || participantesIds.length > 2
      ? 'GRUPAL'
      : 'INDIVIDUAL');

  if (tipoConversacion === 'GRUPAL') {
    assertChatPermission(chatActor, CHAT_PERMISSIONS.MANAGE_GROUP);
  }
  const idConversacion = buildConversationId({
    tipoConversacion,
    participantesIds,
    providedId: authenticatedConversationData.idConversacion ?? authenticatedConversationData.id,
  });

  if (!idConversacion || participantesIds.length < 2) {
    throw new Error('La conversación necesita al menos dos participantes con idMiembros.');
  }

  const rawFirstMessage = asArray(authenticatedConversationData.messages)[0];
  const hasFirstMessage = Boolean(
    rawFirstMessage &&
    (String(rawFirstMessage.texto ?? rawFirstMessage.body ?? '').trim() ||
      asArray(rawFirstMessage.adjuntos ?? rawFirstMessage.attachments).length)
  );
  const primerMensaje = hasFirstMessage
    ? messageToFirestore(
        rawFirstMessage,
        resolveMessageSender({
          messageData: rawFirstMessage,
          conversation: { participantes, participantesIds },
        }),
        idConversacion
      )
    : null;
  const existingConversation = await getConversationDoc(idConversacion, chatStore);

  if (existingConversation) {
    if (primerMensaje) {
      return addMessage(idConversacion, primerMensaje, chatActor, chatStore);
    }

    assertConversationParticipant(existingConversation, chatActor);
    return conversationToUi(existingConversation, null, actorIdMiembros, chatStore);
  }

  const creadoEn =
    authenticatedConversationData.creadoEn ?? authenticatedConversationData.createdAt ?? nowIso();
  const conversationPath = `${COLECCION_CONVERSACIONES}/${idConversacion}`;
  const noLeidosPorIdMiembros = Object.fromEntries(participantesIds.map((id) => [String(id), 0]));

  const conversationDoc = {
    idConversacion,
    tipoConversacion,
    nombreGrupo:
      tipoConversacion === 'GRUPAL' ? authenticatedConversationData.groupName || null : null,
    avatarGrupoUrl: null,
    participantesIds,
    participantes,
    creadoPorIdMiembros: actorIdMiembros,
    administradoresIds: tipoConversacion === 'GRUPAL' ? [actorIdMiembros] : [],
    creadoEn,
    actualizadoEn: primerMensaje?.enviadoEn ?? creadoEn,
    ultimoMensaje: primerMensaje
      ? {
          idMensaje: primerMensaje.idMensaje,
          texto: primerMensaje.texto,
          tipoContenido: primerMensaje.tipoContenido,
          remitenteIdMiembros: primerMensaje.remitenteIdMiembros,
          enviadoEn: primerMensaje.enviadoEn,
        }
      : null,
    noLeidosPorIdMiembros,
    activa: true,
    eliminada: false,
  };

  await chatStore.setDocument(conversationPath, conversationDoc);
  if (primerMensaje) {
    await chatStore.setDocument(
      `${conversationPath}/${SUBCOLECCION_MENSAJES}/${primerMensaje.idMensaje}`,
      primerMensaje
    );

    await createMessageNotifications({
      conversation: conversationDoc,
      message: primerMensaje,
    }).catch((error) => {
      console.error('[chat] no se pudo crear la notificación del primer mensaje', error);
    });
  }

  return conversationToUi(
    conversationDoc,
    primerMensaje ? [messageToUi(primerMensaje)] : [],
    null,
    chatStore
  );
}

async function addMessage(conversationId, messageData = {}, chatActor = {}, chatStore) {
  const existingConversation = await getConversationDoc(conversationId, chatStore);

  if (!existingConversation) {
    throw new Error('La conversación no existe.');
  }

  const viewerIdMiembros = authorizeConversationOperation({
    actor: chatActor,
    conversation: existingConversation,
    permission: CHAT_PERMISSIONS.SEND,
  });
  const authenticatedMessageData = bindAuthenticatedMessage(messageData, {
    idMiembros: viewerIdMiembros,
  });
  const sender = resolveMessageSender({
    messageData: authenticatedMessageData,
    conversation: existingConversation,
  });
  const messageDoc = messageToFirestore(authenticatedMessageData, sender, conversationId);

  if (!messageDoc.remitenteIdMiembros) {
    throw new Error('El mensaje necesita remitenteIdMiembros válido.');
  }

  const conversationPath = `${COLECCION_CONVERSACIONES}/${conversationId}`;
  const noLeidosPorIdMiembros = {
    ...(existingConversation.noLeidosPorIdMiembros ?? {}),
  };

  asArray(existingConversation.participantesIds).forEach((idMiembros) => {
    const key = String(idMiembros);

    noLeidosPorIdMiembros[key] =
      Number(idMiembros) === Number(messageDoc.remitenteIdMiembros)
        ? 0
        : Number(noLeidosPorIdMiembros[key] || 0) + 1;
  });

  await chatStore.setDocument(
    `${conversationPath}/${SUBCOLECCION_MENSAJES}/${messageDoc.idMensaje}`,
    messageDoc
  );
  await chatStore.setDocument(
    conversationPath,
    {
      ...existingConversation,
      actualizadoEn: messageDoc.enviadoEn,
      ultimoMensaje: {
        idMensaje: messageDoc.idMensaje,
        texto: messageDoc.texto,
        tipoContenido: messageDoc.tipoContenido,
        remitenteIdMiembros: messageDoc.remitenteIdMiembros,
        enviadoEn: messageDoc.enviadoEn,
      },
      noLeidosPorIdMiembros,
    },
    { merge: true }
  );

  await createMessageNotifications({
    conversation: { ...existingConversation, idConversacion: conversationId },
    message: messageDoc,
  }).catch((error) => {
    console.error('[chat] no se pudo crear la notificación de mensaje', error);
  });

  return conversationToUi(
    { ...existingConversation, actualizadoEn: messageDoc.enviadoEn, noLeidosPorIdMiembros },
    (await getMessages(conversationId, {}, chatStore)).map(messageToUi),
    viewerIdMiembros,
    chatStore
  );
}

async function markAsSeen(conversationId, chatActor = {}, chatStore) {
  const existingConversation = await getConversationDoc(conversationId, chatStore);

  if (!existingConversation) return null;

  const viewerId = assertConversationParticipant(existingConversation, chatActor);
  const noLeidosPorIdMiembros = { ...(existingConversation.noLeidosPorIdMiembros ?? {}) };

  if (viewerId) {
    noLeidosPorIdMiembros[String(viewerId)] = 0;
  } else {
    Object.keys(noLeidosPorIdMiembros).forEach((idMiembros) => {
      noLeidosPorIdMiembros[idMiembros] = 0;
    });
  }

  const receipt = await updateConversationReceipt({
    conversationId,
    conversation: existingConversation,
    chatActor,
    chatStore,
    markRead: true,
    persist: false,
  });
  await chatStore.commitWrites([
    ...(receipt ? [{ type: 'set', path: receipt.path, data: receipt.data }] : []),
    {
      type: 'set',
      path: `${COLECCION_CONVERSACIONES}/${conversationId}`,
      data: { noLeidosPorIdMiembros },
      merge: true,
    },
  ]);

  return { ...existingConversation, noLeidosPorIdMiembros };
}

async function updateMessageAction({
  conversationId,
  messageId,
  action,
  chatActor = {},
  reaction = '👍',
  text = '',
  chatStore,
}) {
  const existingConversation = await getConversationDoc(conversationId, chatStore);

  if (!existingConversation) {
    throw new Error('La conversación no existe.');
  }

  const permissionByAction = {
    react: CHAT_PERMISSIONS.REACT,
    edit: CHAT_PERMISSIONS.EDIT_OWN,
    delete: CHAT_PERMISSIONS.DELETE_OWN,
    restore: CHAT_PERMISSIONS.DELETE_OWN,
  };
  const permission = permissionByAction[action];

  if (!permission) {
    throw new Error('Acción de mensaje inválida.');
  }

  const viewerIdMiembros = authorizeConversationOperation({
    actor: chatActor,
    conversation: existingConversation,
    permission,
  });

  const messagePath = `${COLECCION_CONVERSACIONES}/${conversationId}/${SUBCOLECCION_MENSAJES}/${messageId}`;
  const messageData = await chatStore.getDocument(messagePath);

  if (!messageData) {
    throw new Error('El mensaje no existe.');
  }

  let nextMessage = messageData;
  let auditEvent = null;
  const updatedAt = nowIso();
  const isLastMessage =
    String(existingConversation?.ultimoMensaje?.idMensaje) === String(messageId);

  if (['edit', 'delete', 'restore'].includes(action)) {
    assertMessageAuthor(messageData, chatActor);
    nextMessage = applyChatMessageLifecycleAction({
      action,
      message: messageData,
      text,
      now: updatedAt,
    });
    auditEvent = createChatAuditEvent({
      action: `mensaje_${action === 'edit' ? 'editado' : action === 'delete' ? 'eliminado' : 'restaurado'}`,
      actorIdMiembros: viewerIdMiembros,
      messageId,
      now: updatedAt,
      details: {
        longitudAnterior: String(messageData.texto ?? '').length,
        longitudActual: String(nextMessage.texto ?? '').length,
        adjuntosAfectados: asArray(
          messageData.adjuntosOriginales ?? messageData.adjuntos
        ).length,
      },
    });
  }

  if (action === 'react') {
    if (messageData.eliminado) {
      throw new ChatMessageValidationError(
        'No se puede reaccionar a un mensaje eliminado.',
        'CHAT_MESSAGE_ALREADY_DELETED'
      );
    }

    const normalizedReaction = normalizeChatReaction(reaction);
    const reactionKey = String(viewerIdMiembros || 'usuario');
    const currentReactions = messageData.reacciones ?? {};
    const currentReaction = currentReactions[reactionKey];
    const nextReactions = { ...currentReactions };

    if (currentReaction === normalizedReaction) {
      delete nextReactions[reactionKey];
    } else {
      nextReactions[reactionKey] = normalizedReaction;
    }

    nextMessage = {
      ...messageData,
      reacciones: nextReactions,
      actualizadoEn: updatedAt,
    };
  }

  const conversationUpdate = isLastMessage
    ? {
        ultimoMensaje: {
          ...(existingConversation.ultimoMensaje || {}),
          texto: nextMessage.texto,
          tipoContenido: nextMessage.tipoContenido,
        },
        actualizadoEn: updatedAt,
      }
    : null;

  if (auditEvent) {
    await chatStore.commitWrites([
      { type: 'set', path: messagePath, data: nextMessage, merge: true },
      {
        type: 'set',
        path: `${COLECCION_CONVERSACIONES}/${conversationId}/auditoria/${auditEvent.idEvento}`,
        data: auditEvent,
      },
      ...(conversationUpdate
        ? [
            {
              type: 'set',
              path: `${COLECCION_CONVERSACIONES}/${conversationId}`,
              data: conversationUpdate,
              merge: true,
            },
          ]
        : []),
    ]);
  } else {
    await chatStore.setDocument(messagePath, nextMessage, { merge: true });
  }

  return conversationToUi(
    {
      ...existingConversation,
      idConversacion: conversationId,
      ultimoMensaje:
        isLastMessage
          ? {
              ...(existingConversation.ultimoMensaje || {}),
              texto: nextMessage.texto,
              tipoContenido: nextMessage.tipoContenido,
            }
          : existingConversation.ultimoMensaje,
    },
    (await getMessages(conversationId, {}, chatStore)).map(messageToUi),
    viewerIdMiembros,
    chatStore
  );
}

async function commitGroupChange({
  conversationId,
  conversation,
  viewerId,
  chatStore,
  action,
  update,
  systemText,
}) {
  const changedAt = nowIso();
  const conversationPath = `${COLECCION_CONVERSACIONES}/${conversationId}`;
  const actor =
    asArray(conversation.participantes).find(
      (participant) => Number(participant.idMiembros) === Number(viewerId)
    ) ?? { idMiembros: viewerId };
  const systemMessage = messageToFirestore(
    {
      id: `sistema_${crypto.randomUUID()}`,
      body: systemText,
      contentType: 'system',
      senderId: viewerId,
      createdAt: changedAt,
      metadata: { groupAction: action },
    },
    actor,
    conversationId
  );
  const participantIds = asArray(update.participantesIds ?? conversation.participantesIds);
  const noLeidosPorIdMiembros = {
    ...(update.noLeidosPorIdMiembros ?? conversation.noLeidosPorIdMiembros ?? {}),
  };

  Object.keys(noLeidosPorIdMiembros).forEach((id) => {
    if (!participantIds.some((participantId) => Number(participantId) === Number(id))) {
      delete noLeidosPorIdMiembros[id];
    }
  });
  participantIds.forEach((id) => {
    noLeidosPorIdMiembros[String(id)] =
      Number(id) === Number(viewerId) ? 0 : Number(noLeidosPorIdMiembros[String(id)] || 0) + 1;
  });

  const conversationUpdate = {
    ...update,
    actualizadoEn: changedAt,
    noLeidosPorIdMiembros,
    ultimoMensaje: {
      idMensaje: systemMessage.idMensaje,
      texto: systemMessage.texto,
      tipoContenido: systemMessage.tipoContenido,
      remitenteIdMiembros: systemMessage.remitenteIdMiembros,
      enviadoEn: systemMessage.enviadoEn,
    },
  };
  const auditEvent = createChatAuditEvent({
    action: `grupo_${action}`,
    actorIdMiembros: viewerId,
    messageId: systemMessage.idMensaje,
    now: changedAt,
    details: { participantes: participantIds.length },
  });

  await chatStore.commitWrites([
    { type: 'set', path: conversationPath, data: conversationUpdate, merge: true },
    {
      type: 'set',
      path: `${conversationPath}/${SUBCOLECCION_MENSAJES}/${systemMessage.idMensaje}`,
      data: systemMessage,
    },
    {
      type: 'set',
      path: `${conversationPath}/auditoria/${auditEvent.idEvento}`,
      data: auditEvent,
    },
  ]);

  const updatedConversation = { ...conversation, ...conversationUpdate };

  if (!participantIds.includes(Number(viewerId))) {
    return { id: String(conversationId), left: true };
  }

  return conversationToUi(updatedConversation, null, viewerId, chatStore);
}

async function updateConversationAction({
  conversationId,
  action,
  chatActor = {},
  comment = '',
  newParticipants = [],
  targetIdMiembros = null,
  administratorIdMiembros = null,
  makeAdmin = false,
  groupName = '',
  groupAvatarUrl = '',
  isTyping = true,
  chatStore,
}) {
  const existingConversation = await getConversationDoc(conversationId, chatStore);

  if (!existingConversation) {
    throw new Error('La conversacion no existe.');
  }

  const conversationPath = `${COLECCION_CONVERSACIONES}/${conversationId}`;
  const permissionByAction = {
    typing: CHAT_PERMISSIONS.SEND,
    'toggle-mute': CHAT_PERMISSIONS.VIEW,
    'mark-delivered': CHAT_PERMISSIONS.VIEW,
    clear: CHAT_PERMISSIONS.CLEAR,
    'clear-global': CHAT_PERMISSIONS.CLEAR,
    report: CHAT_PERMISSIONS.REPORT,
    'add-participants': CHAT_PERMISSIONS.MANAGE_GROUP,
    'remove-participant': CHAT_PERMISSIONS.MANAGE_GROUP,
    'leave-group': CHAT_PERMISSIONS.VIEW,
    'transfer-ownership': CHAT_PERMISSIONS.MANAGE_GROUP,
    'set-group-admin': CHAT_PERMISSIONS.MANAGE_GROUP,
    'update-group': CHAT_PERMISSIONS.MANAGE_GROUP,
  };
  const permission = permissionByAction[action];

  if (!permission) {
    throw new Error('Acción de conversación inválida.');
  }

  const viewerId = authorizeConversationOperation({
    actor: chatActor,
    conversation: existingConversation,
    permission,
    creatorOnly: ['clear-global'].includes(action),
  });

  if (action === 'typing') {
    if (!viewerId) {
      throw new Error('No se pudo identificar el miembro que está escribiendo.');
    }

    const viewerKey = String(viewerId);
    const escribiendoPorIdMiembros = isTyping ? { [viewerKey]: nowIso() } : {};

    await chatStore.setDocument(
      conversationPath,
      { escribiendoPorIdMiembros },
      {
        merge: true,
        // Actualiza únicamente la entrada de este miembro. Así dos personas
        // pueden escribir simultáneamente sin sobrescribirse entre sí.
        fieldPaths: [`escribiendoPorIdMiembros.\`${viewerKey}\``],
      }
    );

    return null;
  }

  if (action === 'toggle-mute') {
    if (!viewerId) {
      throw new Error('No se pudo identificar el miembro para silenciar el chat.');
    }

    const silenciadoPorIdMiembros = { ...(existingConversation.silenciadoPorIdMiembros ?? {}) };

    if (silenciadoPorIdMiembros[String(viewerId)]) {
      delete silenciadoPorIdMiembros[String(viewerId)];
    } else {
      silenciadoPorIdMiembros[String(viewerId)] = true;
    }

    await chatStore.setDocument(conversationPath, { silenciadoPorIdMiembros }, { merge: true });

    return conversationToUi(
      { ...existingConversation, silenciadoPorIdMiembros },
      (await getMessages(conversationId, {}, chatStore)).map(messageToUi),
      viewerId,
      chatStore
    );
  }

  if (action === 'mark-delivered') {
    await updateConversationReceipt({
      conversationId,
      conversation: existingConversation,
      chatActor,
      chatStore,
    });

    return { id: String(conversationId), delivered: true };
  }

  if (action === 'clear') {
    const clearedAt = nowIso();
    const ocultoAntesPorIdMiembros = {
      ...(existingConversation.ocultoAntesPorIdMiembros ?? {}),
      [String(viewerId)]: clearedAt,
    };
    const noLeidosPorIdMiembros = {
      ...(existingConversation.noLeidosPorIdMiembros ?? {}),
      [String(viewerId)]: 0,
    };
    const auditEvent = createChatAuditEvent({
      action: 'conversacion_limpiada_personal',
      actorIdMiembros: viewerId,
      now: clearedAt,
    });

    await chatStore.commitWrites([
      {
        type: 'set',
        path: conversationPath,
        data: { ocultoAntesPorIdMiembros, noLeidosPorIdMiembros },
        merge: true,
      },
      {
        type: 'set',
        path: `${conversationPath}/auditoria/${auditEvent.idEvento}`,
        data: auditEvent,
      },
    ]);

    return conversationToUi(
      {
        ...existingConversation,
        ocultoAntesPorIdMiembros,
        noLeidosPorIdMiembros,
      },
      [],
      viewerId,
      chatStore
    );
  }

  if (action === 'clear-global') {
    const messages = await getAllMessages(conversationId, chatStore);

    if (messages.length > 498) {
      throw new ChatMessageValidationError(
        'La conversación es demasiado grande para limpiarla de forma atómica.',
        'CHAT_GLOBAL_CLEAR_LIMIT_EXCEEDED'
      );
    }

    const clearedAt = nowIso();
    const attachmentPaths = collectChatAttachmentPaths(messages);
    const noLeidosPorIdMiembros = Object.fromEntries(
      asArray(existingConversation.participantesIds).map((idMiembros) => [String(idMiembros), 0])
    );
    const auditEvent = createChatAuditEvent({
      action: 'conversacion_limpiada_global',
      actorIdMiembros: viewerId,
      now: clearedAt,
      details: {
        mensajesEliminados: messages.length,
        adjuntosProgramados: attachmentPaths.length,
      },
    });

    await chatStore.commitWrites([
      ...messages.map((message) => ({
        type: 'delete',
        path: `${conversationPath}/${SUBCOLECCION_MENSAJES}/${message.idMensaje}`,
      })),
      {
        type: 'set',
        path: conversationPath,
        data: {
          actualizadoEn: clearedAt,
          ultimoMensaje: null,
          noLeidosPorIdMiembros,
        },
        merge: true,
      },
      {
        type: 'set',
        path: `${conversationPath}/auditoria/${auditEvent.idEvento}`,
        data: auditEvent,
      },
    ]);

    const storageCleanup = attachmentPaths.length
      ? await deleteChatStorageObjects({
          bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          token: chatActor.token,
          paths: attachmentPaths,
        })
      : { deleted: [], failed: [] };

    if (storageCleanup.failed.length) {
      await chatStore.setDocument(
        `${conversationPath}/auditoria/${auditEvent.idEvento}`,
        {
          detalle: {
            ...auditEvent.detalle,
            adjuntosEliminados: storageCleanup.deleted.length,
            adjuntosPendientes: storageCleanup.failed.map((item) => item.path),
          },
        },
        { merge: true }
      );
    }

    return conversationToUi(
      {
        ...existingConversation,
        actualizadoEn: clearedAt,
        ultimoMensaje: null,
        noLeidosPorIdMiembros,
      },
      [],
      viewerId,
      chatStore
    );
  }

  if (action === 'report') {
    const reporter =
      asArray(existingConversation.participantes).find(
        (participant) => Number(participant.idMiembros) === Number(viewerId)
      ) ?? {};
    const reporterName = buildNombreCompleto(reporter);
    const cleanComment = String(comment || '').trim();

    if (!cleanComment) {
      throw new Error('Escribe un comentario para reportar el chat.');
    }

    const admins = await getAdminNotificationProfiles();
    const createdAt = nowIso();

    await Promise.all(
      admins.map((admin) => {
        const notificationId = `reporte_chat_${conversationId}_${Date.now()}_${admin.uid}`;

        return guardarNotificacionConfigurada({
          id: notificationId,
          tipoNotificacion: 'chat_reportado',
          modulo: 'mensajes',
          titulo: 'Chat reportado',
          tituloHtml: `<p><strong>${escapeHtml(reporterName)}</strong> reporto un chat</p>`,
          mensaje: cleanComment,
          mensajeVisual: cleanComment,
          descripcion: cleanComment,
          rolDestinatario: 'admin',
          idsDestinatarios: [admin.uid],
          prioridad: 'importante',
          estado: 'no_leida',
          fechaCreacion: createdAt,
          fechaEnvio: createdAt,
          fechaActualizacion: createdAt,
          actorId: String(viewerId || ''),
          actorTipo: 'usuario',
          actorNombre: reporterName,
          entidadTipo: 'chat',
          entidadId: String(conversationId),
          ruta: `/dashboard/chat?id=${conversationId}`,
          archivada: false,
          metadatos: {
            idConversacion: String(conversationId),
            reportadoPorIdMiembros: viewerId,
            reportadoPor: reporterName,
            comentario: cleanComment,
          },
          actualizadoEnServidor: serverTimestamp(),
        });
      })
    );

    return conversationToUi(
      existingConversation,
      (await getMessages(conversationId, {}, chatStore)).map(messageToUi),
      viewerId,
      chatStore
    );
  }

  if (action === 'add-participants') {
    assertChatGroupAdmin(existingConversation, viewerId);
    const candidatos = asArray(newParticipants);
    const [members, firestoreProfiles] = await Promise.all([
      getMembersFromApi().catch(() => []),
      getMembersFromFirestoreProfiles().catch(() => []),
    ]);
    const contacts = getAllContacts([...members, ...firestoreProfiles]);

    const nuevosParticipantes = candidatos
      .map((candidato) => resolveParticipantFromContacts(candidato, contacts))
      .filter(
        (member) =>
          member.idMiembros &&
          !asArray(existingConversation.participantesIds).includes(member.idMiembros)
      )
      .map(toPublicChatContact);

    if (!nuevosParticipantes.length) {
      return conversationToUi(
        existingConversation,
        (await getMessages(conversationId, {}, chatStore)).map(messageToUi),
        viewerId,
        chatStore
      );
    }

    const participantes = [...asArray(existingConversation.participantes), ...nuevosParticipantes];
    const participantesIds = [
      ...new Set([
        ...asArray(existingConversation.participantesIds),
        ...nuevosParticipantes.map((member) => member.idMiembros),
      ]),
    ];
    const noLeidosPorIdMiembros = { ...(existingConversation.noLeidosPorIdMiembros ?? {}) };

    nuevosParticipantes.forEach((member) => {
      noLeidosPorIdMiembros[String(member.idMiembros)] = 0;
    });

    const actorName = buildNombreCompleto(
      asArray(existingConversation.participantes).find(
        (participant) => Number(participant.idMiembros) === Number(viewerId)
      ) ?? {}
    );

    return commitGroupChange({
      conversationId,
      conversation: existingConversation,
      viewerId,
      chatStore,
      action: 'participantes_agregados',
      update: {
        participantes,
        participantesIds,
        noLeidosPorIdMiembros,
        tipoConversacion: 'GRUPAL',
        administradoresIds: asArray(existingConversation.administradoresIds).length
          ? existingConversation.administradoresIds
          : [existingConversation.creadoPorIdMiembros],
      },
      systemText: `${actorName} agregó a ${nuevosParticipantes.map(buildNombreCompleto).join(', ')} al grupo.`,
    });
  }

  if (['remove-participant', 'leave-group'].includes(action)) {
    const removalTargetId = action === 'leave-group' ? viewerId : targetIdMiembros;

    if (!removalTargetId) {
      throw new Error('Falta indicar el participante a quitar.');
    }

    const removal = validateChatGroupRemoval({
      conversation: existingConversation,
      actorIdMiembros: viewerId,
      targetIdMiembros: removalTargetId,
    });
    const participantesIds = removal.participantesIds;
    const participantes = asArray(existingConversation.participantes).filter(
      (member) => Number(member.idMiembros) !== Number(removal.targetId)
    );
    const noLeidosPorIdMiembros = { ...(existingConversation.noLeidosPorIdMiembros ?? {}) };
    const silenciadoPorIdMiembros = { ...(existingConversation.silenciadoPorIdMiembros ?? {}) };
    const removedParticipant = asArray(existingConversation.participantes).find(
      (member) => Number(member.idMiembros) === Number(removal.targetId)
    );

    delete noLeidosPorIdMiembros[String(removal.targetId)];
    delete silenciadoPorIdMiembros[String(removal.targetId)];

    return commitGroupChange({
      conversationId,
      conversation: existingConversation,
      viewerId,
      chatStore,
      action: action === 'leave-group' ? 'miembro_salio' : 'participante_retirado',
      update: {
        participantes,
        participantesIds,
        administradoresIds: removal.administradoresIds,
        noLeidosPorIdMiembros,
        silenciadoPorIdMiembros,
      },
      systemText:
        action === 'leave-group'
          ? `${buildNombreCompleto(removedParticipant)} salió del grupo.`
          : `${buildNombreCompleto(removedParticipant)} fue retirado del grupo.`,
    });
  }

  if (action === 'transfer-ownership') {
    assertChatGroupCreator(existingConversation, viewerId);
    const transfer = transferChatGroupOwnership({
      conversation: existingConversation,
      actorIdMiembros: viewerId,
      targetIdMiembros,
    });
    const target = asArray(existingConversation.participantes).find(
      (participant) => Number(participant.idMiembros) === Number(transfer.creadoPorIdMiembros)
    );

    return commitGroupChange({
      conversationId,
      conversation: existingConversation,
      viewerId,
      chatStore,
      action: 'propiedad_transferida',
      update: transfer,
      systemText: `${buildNombreCompleto(target)} ahora es el creador del grupo.`,
    });
  }

  if (action === 'set-group-admin') {
    const adminUpdate = updateChatGroupAdministrator({
      conversation: existingConversation,
      actorIdMiembros: viewerId,
      targetIdMiembros: administratorIdMiembros,
      makeAdmin,
    });
    const target = asArray(existingConversation.participantes).find(
      (participant) => Number(participant.idMiembros) === Number(administratorIdMiembros)
    );

    return commitGroupChange({
      conversationId,
      conversation: existingConversation,
      viewerId,
      chatStore,
      action: makeAdmin ? 'administrador_agregado' : 'administrador_retirado',
      update: adminUpdate,
      systemText: `${buildNombreCompleto(target)} ${makeAdmin ? 'ahora es administrador' : 'dejó de ser administrador'} del grupo.`,
    });
  }

  if (action === 'update-group') {
    const details = updateChatGroupDetails({
      conversation: existingConversation,
      actorIdMiembros: viewerId,
      name: groupName,
      avatarUrl: groupAvatarUrl,
    });

    return commitGroupChange({
      conversationId,
      conversation: existingConversation,
      viewerId,
      chatStore,
      action: 'detalles_actualizados',
      update: details,
      systemText: `Se actualizaron los detalles del grupo ${details.nombreGrupo}.`,
    });
  }

  throw new Error('Accion de conversacion invalida.');
}

export async function GET(req) {
  try {
    const chatActor = await authenticateChatRequest(req);
    assertChatPermission(chatActor, CHAT_PERMISSIONS.VIEW);
    ensureFirestore();

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    const conversationId = searchParams.get('conversationId');
    const viewerIdMiembros = chatActor.idMiembros;
    const chatStore = createChatStore(chatActor);

    if (endpoint === 'contacts') {
      const [members, firestoreProfiles] = await Promise.all([
        getMembersFromApi(),
        getMembersFromFirestoreProfiles(),
      ]);

      return Response.json(
        { contacts: getAllContacts([...members, ...firestoreProfiles]) },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    if (endpoint === 'unread-summary') {
      return Response.json(await getUnreadSummary(viewerIdMiembros, chatStore));
    }

    if (endpoint === 'conversations') {
      const conversations = await getConversations(viewerIdMiembros, chatStore);

      return Response.json({ conversations });
    }

    if (endpoint === 'conversation') {
      const conversation = await getConversationDoc(conversationId, chatStore);

      if (!conversation) {
        return Response.json({ message: 'Conversación no encontrada.' }, { status: 404 });
      }

      assertConversationParticipant(conversation, chatActor);
      await updateConversationReceipt({
        conversationId,
        conversation,
        chatActor,
        chatStore,
      });

      return Response.json({
        conversation: await conversationToUi(conversation, null, viewerIdMiembros, chatStore),
      });
    }

    if (endpoint === 'older-messages') {
      const conversation = await getConversationDoc(conversationId, chatStore);

      if (!conversation) {
        return Response.json({ message: 'Conversación no encontrada.' }, { status: 404 });
      }

      assertConversationParticipant(conversation, chatActor);

      const before = searchParams.get('before');
      const visibilityCutoff = getPersonalClearCutoff(conversation, viewerIdMiembros);
      const olderMessages = await getMessages(
        conversationId,
        {
          pageLimit: DEFAULT_MESSAGES_PAGE_SIZE,
          beforeEnviadoEn: before,
          afterEnviadoEn: visibilityCutoff,
        },
        chatStore
      );

      return Response.json({ messages: olderMessages.map(messageToUi) });
    }

    if (endpoint === 'mark-as-seen') {
      await markAsSeen(conversationId, chatActor, chatStore);

      return Response.json({ success: true });
    }

    return Response.json({ message: 'Endpoint de chat inválido.' }, { status: 400 });
  } catch (error) {
    const authenticationResponse = chatAuthenticationErrorResponse(error);
    const authorizationResponse = chatAuthorizationErrorResponse(error);
    const firestoreResponse = chatFirestoreErrorResponse(error);
    const messageValidationResponse = chatMessageValidationErrorResponse(error);
    const groupResponse = chatGroupErrorResponse(error);

    if (authenticationResponse) return authenticationResponse;
    if (authorizationResponse) return authorizationResponse;
    if (firestoreResponse) return firestoreResponse;
    if (messageValidationResponse) return messageValidationResponse;
    if (groupResponse) return groupResponse;

    return Response.json(
      { message: error?.message || 'Error procesando el chat.' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const chatActor = await authenticateChatRequest(req);
    ensureFirestore();
    const chatStore = createChatStore(chatActor);

    const body = await req.json();
    const conversation = await createConversation(body.conversationData, chatActor, chatStore);

    return Response.json({ conversation });
  } catch (error) {
    const authenticationResponse = chatAuthenticationErrorResponse(error);
    const authorizationResponse = chatAuthorizationErrorResponse(error);
    const firestoreResponse = chatFirestoreErrorResponse(error);
    const messageValidationResponse = chatMessageValidationErrorResponse(error);
    const groupResponse = chatGroupErrorResponse(error);

    if (authenticationResponse) return authenticationResponse;
    if (authorizationResponse) return authorizationResponse;
    if (firestoreResponse) return firestoreResponse;
    if (messageValidationResponse) return messageValidationResponse;
    if (groupResponse) return groupResponse;

    return Response.json(
      { message: error?.message || 'Error creando la conversación.' },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const chatActor = await authenticateChatRequest(req);
    ensureFirestore();
    const chatStore = createChatStore(chatActor);

    const body = await req.json();
    const conversation = await addMessage(
      body.conversationId,
      body.messageData,
      chatActor,
      chatStore
    );

    return Response.json({ conversation });
  } catch (error) {
    const authenticationResponse = chatAuthenticationErrorResponse(error);
    const authorizationResponse = chatAuthorizationErrorResponse(error);
    const firestoreResponse = chatFirestoreErrorResponse(error);
    const messageValidationResponse = chatMessageValidationErrorResponse(error);
    const groupResponse = chatGroupErrorResponse(error);

    if (authenticationResponse) return authenticationResponse;
    if (authorizationResponse) return authorizationResponse;
    if (firestoreResponse) return firestoreResponse;
    if (messageValidationResponse) return messageValidationResponse;
    if (groupResponse) return groupResponse;

    return Response.json(
      { message: error?.message || 'Error enviando el mensaje.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const chatActor = await authenticateChatRequest(req);
    ensureFirestore();
    const chatStore = createChatStore(chatActor);

    const body = await req.json();
    const conversationActions = [
      'toggle-mute',
      'mark-delivered',
      'report',
      'clear',
      'clear-global',
      'typing',
      'add-participants',
      'remove-participant',
      'leave-group',
      'transfer-ownership',
      'set-group-admin',
      'update-group',
    ];

    const conversation = conversationActions.includes(body.action)
      ? await updateConversationAction({
          conversationId: body.conversationId,
          action: body.action,
          chatActor,
          comment: body.comment,
          newParticipants: body.newParticipants,
          targetIdMiembros: toNumberOrNull(body.targetIdMiembros),
          administratorIdMiembros: toNumberOrNull(body.administratorIdMiembros),
          makeAdmin: Boolean(body.makeAdmin),
          groupName: body.groupName,
          groupAvatarUrl: body.groupAvatarUrl,
          isTyping: body.isTyping !== false,
          chatStore,
        })
      : await updateMessageAction({
          conversationId: body.conversationId,
          messageId: body.messageId,
          action: body.action,
          chatActor,
          reaction: body.reaction,
          text: body.text,
          chatStore,
        });

    return Response.json({ conversation });
  } catch (error) {
    const authenticationResponse = chatAuthenticationErrorResponse(error);
    const authorizationResponse = chatAuthorizationErrorResponse(error);
    const firestoreResponse = chatFirestoreErrorResponse(error);
    const messageValidationResponse = chatMessageValidationErrorResponse(error);
    const groupResponse = chatGroupErrorResponse(error);

    if (authenticationResponse) return authenticationResponse;
    if (authorizationResponse) return authorizationResponse;
    if (firestoreResponse) return firestoreResponse;
    if (messageValidationResponse) return messageValidationResponse;
    if (groupResponse) return groupResponse;

    return Response.json(
      { message: error?.message || 'Error actualizando el mensaje.' },
      { status: 500 }
    );
  }
}
