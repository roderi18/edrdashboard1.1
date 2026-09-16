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

import { toggleChatReaction } from 'src/utils/chat-reaction-core.mjs';
import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';
import {
  contactoDeBuzon,
  esBuzonCompartido,
  buzonPorIdMiembros,
} from 'src/utils/chat-buzones.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { getAdminDb, isAdminConfigured } from 'src/server/firebase-admin';
import { deleteChatStorageObjects } from 'src/server/chat-storage-rest.mjs';
import { getChatMemberDirectory } from 'src/server/chat-identity-directory.mjs';
import { resolverNotificacionConConfiguracion } from 'src/services/notification-service';
import { startChatOperation, toSafeChatErrorMetric } from 'src/server/chat-observability.mjs';
import { toPublicChatContact, getPublicChatContacts } from 'src/server/chat-contact-core.mjs';
import {
  ChatFirestoreRestError,
  createChatFirestoreRestClient,
} from 'src/server/chat-firestore-rest.mjs';
import {
  buildChatReceipt,
  shouldAdvanceChatReceipt,
  applyChatReceiptsToMessages,
} from 'src/server/chat-receipts.mjs';
import {
  buildConversationPage,
  normalizeChatPageSize,
  decodeConversationCursor,
} from 'src/server/chat-pagination.mjs';
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
  AVISO_SEGUNDO,
  relojSinResponder,
  avisoPendienteDeBuzon,
  idDeAvisoSinResponder,
  textoDeAvisoSinResponder,
} from 'src/server/chat-buzon-sin-responder.mjs';
import {
  autenticarBuzon,
  perfilesDelBuzon,
  contactosDeBuzones,
  avatarActualDeBuzon,
  leerRespuestasDeBuzon,
  registrarRespuestaDeBuzon,
} from 'src/server/chat-buzones';
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
  CHAT_GROUP_HISTORY_VISIBILITY,
  applyAddedParticipantHistoryVisibility,
} from 'src/server/chat-group-core.mjs';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES = 'mensajes';
const COLECCIONES_USUARIOS = ['users', 'usuarios_roles', 'admins'];
const COLECCION_FOTOS = 'fotos';
const MEMBER_PHOTO_CACHE_TTL_MS = 5 * 60_000;
const memberPhotoCache = new Map();

// TODAS las fotos de miembro, de una sola lectura.
//
// La lista de contactos son cientos de personas: pedir su foto una por una
// serian cientos de lecturas cada vez que alguien abre el buscador del chat.
// Se traen juntas y se guardan un rato.
let fotosDeTodos = null;
let fotosDeTodosHasta = 0;

const mapaDeFotosDeMiembros = async () => {
  if (fotosDeTodos && fotosDeTodosHasta > Date.now()) return fotosDeTodos;

  const fotos = new Map();

  if (isAdminConfigured()) {
    const snapshot = await getAdminDb()
      .collection(COLECCION_FOTOS)
      .where('tipoEntidad', '==', 'miembro')
      .get()
      .catch(() => null);

    snapshot?.forEach((documento) => {
      const datos = documento.data() ?? {};

      if (datos.tipoFoto !== 'perfil' || datos.estado !== 'activo') return;

      const idEntidad = String(datos.idEntidad ?? '').trim();

      // La miniatura primero: en una lista de cientos, la diferencia entre
      // 10 kB y 300 kB por cara es la diferencia entre abrir y esperar.
      const cara = datos.urlFotoMiniatura || datos.urlFoto;

      if (idEntidad && cara) fotos.set(idEntidad, String(cara));
    });
  }

  fotosDeTodos = fotos;
  fotosDeTodosHasta = Date.now() + MEMBER_PHOTO_CACHE_TTL_MS;

  return fotos;
};

/** Los contactos, con su cara. */
const conSusFotos = async (contactos = []) => {
  const fotos = await mapaDeFotosDeMiembros().catch(() => new Map());

  if (!fotos.size) return contactos;

  return contactos.map((contacto) =>
    contacto.avatarUrl
      ? contacto
      : { ...contacto, avatarUrl: fotos.get(String(contacto.idMiembros ?? contacto.id)) || '' }
  );
};

const chatAuthorizationErrorResponse = (error) => {
  if (!(error instanceof ChatAuthorizationError)) return null;

  return Response.json({ message: error.message, code: error.code }, { status: error.status });
};

const chatFirestoreErrorResponse = (error) => {
  if (!(error instanceof ChatFirestoreRestError)) return null;

  const quotaExceeded =
    error.code === 'RESOURCE_EXHAUSTED' || /quota exceeded/i.test(error.message || '');
  const status = quotaExceeded
    ? 429
    : error.status === 401
      ? 401
      : error.status === 403
        ? 403
        : 503;
  const message = quotaExceeded
    ? '🔥 La fogata está encendiéndose. En unos minutos podrás continuar la conversación.'
    : error.message;

  return Response.json(
    { message, code: error.code },
    { status, ...(quotaExceeded ? { headers: { 'Retry-After': '60' } } : {}) }
  );
};

const chatMessageValidationErrorResponse = (error) => {
  if (!(error instanceof ChatMessageValidationError)) return null;

  return Response.json({ message: error.message, code: error.code }, { status: error.status });
};

const chatGroupErrorResponse = (error) => {
  if (!(error instanceof ChatGroupError)) return null;

  return Response.json({ message: error.message, code: error.code }, { status: error.status });
};

const buildChatErrorResponse = (error, requestId, fallbackMessage) => {
  const response =
    chatAuthenticationErrorResponse(error) ||
    chatAuthorizationErrorResponse(error) ||
    chatFirestoreErrorResponse(error) ||
    chatMessageValidationErrorResponse(error) ||
    chatGroupErrorResponse(error) ||
    Response.json(
      {
        message: fallbackMessage,
        code: 'CHAT_INTERNAL_ERROR',
        requestId,
      },
      { status: 500 }
    );

  response.headers.set('X-Chat-Request-ID', requestId);
  return response;
};

const createChatStore = (chatActor = {}) =>
  createChatFirestoreRestClient({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    token: chatActor.token,
  });

// ¿QUIEN PIDE: UNA PERSONA O UN BUZON COMPARTIDO?
//
// Todas las llamadas del chat ya mandan el `idMiembros` de quien esta mirando,
// aunque el servidor no se fiaba de el —la identidad sale del token—. Ese dato
// decide una sola cosa: si viene el de un buzon (Tienda Virtual, Oficina
// Nacional), la peticion quiere actuar como ese buzon. Y eso NO se concede por
// pedirlo: `autenticarBuzon` comprueba el cargo de la persona para ESE buzon
// antes de darle su identidad.
const autenticarActorDelChat = (req, idMiembrosPedido) => {
  const buzon = buzonPorIdMiembros(idMiembrosPedido);

  return buzon ? autenticarBuzon(buzon, req) : authenticateChatRequest(req);
};

// Los buzones son un contacto mas para todo el mundo: asi se los encuentra en el
// buscador y se les puede escribir, con la foto que haya elegido el
// Administrador Global. Si el padron trajera a alguien con uno de sus numeros,
// se queda el buzon: una persona nunca ocupa su lugar.
const conLosBuzones = async (contactos = []) => [
  ...contactos.filter((contacto) => !esBuzonCompartido(contacto?.idMiembros ?? contacto?.id)),
  ...(await contactosDeBuzones()),
];

// Quien contesto cada mensaje del buzon —nombre y usuario—. SOLO se añade cuando
// mira el buzon el Administrador Global: al miembro nunca le llega, y el resto de
// quienes atienden el buzon tampoco lo ven —para ellos y para el miembro, quien
// contesta es el buzon—. Queda ademas en Historial para la auditoria.
const conQuienContesto = async (conversationUi, chatActor) => {
  const buzon =
    chatActor?.esBuzonCompartido && chatActor?.responsable?.esAdministradorGlobal
      ? buzonPorIdMiembros(chatActor.idMiembros)
      : null;

  // Sin lista de mensajes no hay nada que anotar: algunas acciones (entregado,
  // escribiendo) devuelven un acuse y no la conversacion.
  if (!buzon || !conversationUi?.id || !Array.isArray(conversationUi.messages)) {
    return conversationUi;
  }

  const respuestas = await leerRespuestasDeBuzon(buzon, conversationUi.id).catch(() => new Map());

  if (!respuestas.size) return conversationUi;

  return {
    ...conversationUi,
    messages: asArray(conversationUi.messages).map((message) => {
      const respuesta = respuestas.get(String(message.id));

      if (!respuesta) return message;

      return {
        ...message,
        respondidoPor: respuesta.nombre,
        ...(respuesta.usuario && { respondidoPorUsuario: respuesta.usuario }),
      };
    }),
  };
};

const anotarRespuestaDeBuzon = (chatActor, idConversacion, idMensaje) => {
  const buzon = chatActor?.esBuzonCompartido ? buzonPorIdMiembros(chatActor.idMiembros) : null;

  if (!buzon) return Promise.resolve();

  // Dejar constancia es un extra: el mensaje ya esta enviado.
  return registrarRespuestaDeBuzon({
    buzon,
    idConversacion,
    idMensaje,
    responsable: chatActor.responsable,
  }).catch((error) => {
    console.warn(
      JSON.stringify({ event: 'chat_buzon_responsable_error', ...toSafeChatErrorMetric(error) })
    );
  });
};

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

  // ESTA ESCRITURA ES DEL SERVIDOR, Y TIENE QUE FIRMAR COMO EL SERVIDOR.
  //
  // Se hacia con el SDK del navegador ejecutandose aqui, en el servidor, donde
  // NO hay ninguna sesion: `request.auth` llega nulo y las reglas la niegan
  // siempre. Y como el aviso se guardaba dentro del envio del mensaje, esa
  // negativa tumbaba el envio entero: al que escribia le salia "permisos
  // insuficientes" aunque su mensaje ya estuviera guardado.
  //
  // El Admin SDK escribe como lo que esto es: el servidor.
  if (isAdminConfigured()) {
    await getAdminDb()
      .collection(COLECCIONES_NOTIFICACIONES.notificaciones)
      .doc(notificacionConfigurada.id)
      .set(notificacionConfigurada);

    return notificacionConfigurada;
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
  const contacts = await conLosBuzones(getAllContacts([...members, ...firestoreProfiles]));

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
  // Un buzon sale siempre con su foto ACTUAL, no con la que quedo guardada en la
  // conversacion cuando se abrio: si el Administrador Global la cambia, cambia
  // tambien en las conversaciones de antes.
  const buzon = buzonPorIdMiembros(member.idMiembros ?? member.id);

  if (buzon) {
    return {
      ...memberToContact(member),
      ...contactoDeBuzon(buzon, await avatarActualDeBuzon(buzon)),
    };
  }

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
  { includeReceipts = true, summaryOnly = false, enrichParticipantPhotos = true } = {}
) => {
  const visibilityCutoff = getPersonalClearCutoff(conversation, viewerIdMiembros);
  const candidateMessages =
    messages ??
    (summaryOnly
      ? conversation.ultimoMensaje
        ? [messageToUi(conversation.ultimoMensaje)]
        : []
      : (
          await getMessages(
            conversation.idConversacion ?? conversation.id,
            { afterEnviadoEn: visibilityCutoff },
            chatStore
          )
        ).map((message) => messageToUi(message)));
  const visibilityCutoffMs = visibilityCutoff ? new Date(visibilityCutoff).getTime() : null;
  const loadedMessages = visibilityCutoff
    ? candidateMessages.filter((message) => {
        const sentAtMs = new Date(message.enviadoEn ?? message.createdAt ?? '').getTime();

        return Number.isFinite(sentAtMs) && sentAtMs > visibilityCutoffMs;
      })
    : candidateMessages;
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
      !!viewerIdMiembros && Number(conversation.creadoPorIdMiembros) === Number(viewerIdMiembros),
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
    visibleAfter: visibilityCutoff,
    participants: enrichParticipantPhotos
      ? await Promise.all(asArray(conversation.participantes).map(contactWithCurrentPhoto))
      : asArray(conversation.participantes).map(toPublicChatContact),
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
  return asArray(await getChatMemberDirectory())
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
  // El buzon va ANTES que la foto que llegue de fuera: la que trae el
  // participante es la de cuando se abrio la conversacion, y con ella los avisos
  // seguian enseñando la foto vieja despues de cambiarla.
  const buzon = buzonPorIdMiembros(idMiembros);

  if (buzon) {
    return avatarActualDeBuzon(buzon);
  }

  if (fallbackUrl) {
    return fallbackUrl;
  }

  const memberId = toNumberOrNull(idMiembros);

  if (!memberId) {
    return '';
  }

  const cached = memberPhotoCache.get(memberId);

  if (cached?.expiresAt > Date.now()) return cached.promise;
  if (cached) memberPhotoCache.delete(memberId);

  const promise = loadMemberPhotoUrl(memberId).catch((error) => {
    if (memberPhotoCache.get(memberId)?.promise === promise) memberPhotoCache.delete(memberId);
    throw error;
  });

  memberPhotoCache.set(memberId, {
    expiresAt: Date.now() + MEMBER_PHOTO_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

// LA FOTO SE BUSCA COMO EL SERVIDOR, NO COMO UN NAVEGADOR SIN SESION.
//
// Esto se leia con el SDK del navegador ejecutandose aqui, donde no hay sesion
// ninguna: `request.auth` llega nulo y las reglas niegan la lectura. Devolvia
// siempre vacio, en silencio, y por eso en el chat NADIE tenia cara: ni en la
// lista, ni en la cabecera, ni en los mensajes. Se veia el monigote gris.
const fotoDelMiembroSegunElServidor = async (memberId) => {
  const db = getAdminDb();
  const guardada = await db.collection(COLECCION_FOTOS).doc(`miembro_${memberId}_perfil`).get();
  const foto = guardada.exists ? (guardada.data() ?? {}) : null;

  if (foto?.estado === 'activo' && foto.urlFoto) {
    return String(foto.urlFoto);
  }

  // Sin foto propia vigente, se mira si algun perfil suyo trae una.
  const perfiles = await Promise.all(
    COLECCIONES_USUARIOS.map((nombreColeccion) =>
      db
        .collection(nombreColeccion)
        .where('idMiembros', '==', memberId)
        .get()
        .catch(() => ({ docs: [] }))
    )
  );

  const conFoto = perfiles
    .flatMap((snapshot) => snapshot.docs.map((item) => item.data() ?? {}))
    .find((perfil) => perfil.photoURL || perfil.avatarUrl || perfil.urlFoto);

  return conFoto?.photoURL || conFoto?.avatarUrl || conFoto?.urlFoto || '';
};

async function loadMemberPhotoUrl(memberId) {
  if (isAdminConfigured()) {
    return fotoDelMiembroSegunElServidor(memberId).catch(() => '');
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
  // ESCRIBIRLE A UN BUZON AVISA A QUIEN LO ATIENDE. Un buzon no tiene cuenta que
  // reciba avisos: sin esto, el mensaje llegaba y nadie se enteraba hasta abrir
  // el chat. Avisa a quien ejerce uno de los cargos de ESE buzon, y el enlace
  // abre la conversacion ya dentro de su bandeja.
  const buzonesDestino = recipientsIds.map(buzonPorIdMiembros).filter(Boolean);
  const recipientProfiles = [
    ...(await getNotificationProfilesByMemberIds(
      recipientsIds.filter((idMiembros) => !esBuzonCompartido(idMiembros))
    )),
    ...(
      await Promise.all(
        buzonesDestino.map(async (buzon) =>
          (await perfilesDelBuzon(buzon).catch(() => [])).map((profile) => ({
            ...profile,
            idMiembros: buzon.idMiembros,
            buzon,
          }))
        )
      )
    ).flat(),
  ];
  const idConversacion = conversation.idConversacion || conversation.id;

  await Promise.all(
    recipientProfiles.map((profile) => {
      // La clave lleva el buzon: quien atiende la Tienda y la Oficina recibe un
      // aviso por cada una, no uno que pisa al otro.
      const notificationId = `mensaje_recibido_${idConversacion}_${message.idMensaje}_${profile.uid}${profile.buzon ? `_${profile.buzon.clave}` : ''}`;
      const frase = profile.buzon ? profile.buzon.fraseAviso : 'te envió un mensaje';

      return guardarNotificacionConfigurada({
        id: notificationId,
        tipoNotificacion: 'mensaje_recibido',
        modulo: 'mensajes',
        titulo: profile.buzon ? profile.buzon.tituloAviso : 'Mensaje recibido',
        tituloHtml: `<p><strong>${escapeHtml(senderName)}</strong> ${frase}</p>`,
        mensaje: `${frase}.`,
        mensajeVisual: `${frase}.`,
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
        ruta: profile.buzon
          ? `/dashboard/chat?id=${idConversacion}&bandeja=${profile.buzon.clave}`
          : `/dashboard/chat?id=${idConversacion}`,
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
          // Un aviso de buzon va a quien lo atiende por su uid, tenga o no una
          // sesion de administrador: la campana no lo filtra por rol.
          ...(profile.buzon && { buzon: profile.buzon.clave }),
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

// ----------------------------------------------------------------------
// AVISAR DE LO QUE LE ESCRIBEN A UN BUZON Y NADIE CONTESTA.
//
// Cuando y a quien esta en `chat-buzon-sin-responder.mjs`; aqui solo se escribe.
//
// SE MIRA CUANDO ALGUIEN PREGUNTA POR SU BANDEJA. No hay tareas programadas en
// esta aplicacion, asi que el momento de comprobarlo es el unico que hay: cuando
// quien atiende el buzon tiene la aplicacion abierta y el panel pide su contador
// (`unread-summary`). Las conversaciones ya vienen leidas de esa misma consulta,
// asi que mirar el reloj no cuesta ni una lectura mas.
//
// Y SE MIRA POCO. Ese contador se pide a menudo y lo piden todos los que
// atienden el buzon; sin este freno, cada uno repetiria la misma comprobacion.
// Un minuto arriba o abajo no le cambia nada a un plazo de una hora.
const ULTIMA_REVISION_DE_BUZON = new Map();
const CADA_CUANTO_SE_REVISA_MS = 5 * 60_000;

const existeNotificacion = async (id) => {
  if (isAdminConfigured()) {
    return (
      await getAdminDb().collection(COLECCIONES_NOTIFICACIONES.notificaciones).doc(id).get()
    ).exists;
  }

  return (await getDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, id))).exists();
};

async function avisarDeLoQueNadieContesta(buzon, conversaciones = []) {
  const ahora = Date.now();

  if (ahora - (ULTIMA_REVISION_DE_BUZON.get(buzon.clave) ?? 0) < CADA_CUANTO_SE_REVISA_MS) return;

  ULTIMA_REVISION_DE_BUZON.set(buzon.clave, ahora);

  const pendientes = conversaciones
    .map((conversacion) => ({
      conversacion,
      paso: avisoPendienteDeBuzon({ conversacion, idMiembrosBuzon: buzon.idMiembros, ahora }),
    }))
    .filter((pendiente) => pendiente.paso);

  if (!pendientes.length) return;

  // Quien ejerce el cargo del buzon y el Administrador Global: los mismos que
  // reciben el aviso del mensaje.
  const perfiles = await perfilesDelBuzon(buzon).catch(() => []);

  if (!perfiles.length) return;

  await Promise.all(
    pendientes.flatMap(({ conversacion, paso }) => {
      const idConversacion = String(conversacion.idConversacion ?? conversacion.id ?? '');
      const remitenteIdMiembros = Number(conversacion.ultimoMensaje?.remitenteIdMiembros);
      const remitente = asArray(conversacion.participantes).find(
        (participante) => Number(participante.idMiembros) === remitenteIdMiembros
      );
      const nombreDeQuienEscribio = buildNombreCompleto(remitente ?? {});
      const texto = textoDeAvisoSinResponder({ buzon, paso, nombreDeQuienEscribio });

      return perfiles.map(async (perfil) => {
        const id = idDeAvisoSinResponder({ buzon, idConversacion, paso, uid: perfil.uid });

        // Si ya se escribio, no se toca: `guardarNotificacionConfigurada` pisa el
        // documento entero, y volver a escribirlo la devolveria a "no leida" cada
        // vez que alguien abre la aplicacion.
        if (await existeNotificacion(id).catch(() => true)) return;

        await guardarNotificacionConfigurada({
          id,
          tipoNotificacion: 'buzon_sin_responder',
          modulo: 'mensajes',
          titulo: `Sin responder en ${buzon.nombre}`,
          tituloHtml: `<p><strong>${escapeHtml(nombreDeQuienEscribio)}</strong> sigue esperando respuesta</p>`,
          mensaje: texto,
          mensajeVisual: texto,
          rolDestinatario: perfil.rolDestinatario,
          idsDestinatarios: [perfil.uid],
          prioridad: paso === AVISO_SEGUNDO ? 'urgente' : 'importante',
          estado: 'no_leida',
          fechaCreacion: nowIso(),
          fechaEnvio: nowIso(),
          actorId: String(remitenteIdMiembros || ''),
          actorTipo: 'usuario',
          actorNombre: nombreDeQuienEscribio,
          actorFotoURL: null,
          entidadTipo: 'conversacion',
          entidadId: idConversacion,
          ruta: `/dashboard/chat?id=${idConversacion}&bandeja=${buzon.clave}`,
          imagenTipo: 'persona',
          imagenURL: null,
          miniaturaURL: null,
          tipoAccion: 'responder',
          etiquetaAccion: 'Responder',
          tipoAccionSecundaria: null,
          etiquetaAccionSecundaria: null,
          leidaPor: [],
          fechaProgramada: null,
          fechaExpiracion: null,
          fechaLectura: null,
          metadatos: {
            // El texto entero, para que la plantilla configurable lo pinte tal
            // cual: el primer aviso y el segundo no dicen lo mismo.
            textoDelAviso: texto,
            buzon: buzon.clave,
            paso,
            idConversacion,
            remitenteIdMiembros,
            sinResponderDesde:
              conversacion.sinResponderDesde || conversacion.ultimoMensaje?.enviadoEn || '',
          },
          creadoEnServidor: serverTimestamp(),
          actualizadoEnServidor: serverTimestamp(),
        });
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
  const readUntil = markRead ? deliveredUntil : null;

  if (!shouldAdvanceChatReceipt({ existing: existingReceipt, deliveredUntil, readUntil })) {
    return { path: receiptPath, data: existingReceipt, changed: false };
  }

  const receipt = buildChatReceipt({
    existing: existingReceipt,
    idMiembros: viewerId,
    deliveredUntil,
    readUntil,
    now: nowIso(),
  });

  if (persist) {
    await chatStore.setDocument(receiptPath, receipt);
  }

  return { path: receiptPath, data: receipt, changed: true };
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

async function getConversations(
  viewerIdMiembros = null,
  chatStore,
  { pageSize: requestedPageSize, cursor: requestedCursor } = {}
) {
  const viewerId = toNumberOrNull(viewerIdMiembros);
  const pageSize = normalizeChatPageSize(requestedPageSize);
  const cursor = decodeConversationCursor(requestedCursor);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const conversations = await chatStore.runQuery({
    collectionId: COLECCION_CONVERSACIONES,
    filters: [
      { field: 'eliminada', op: '==', value: false },
      ...(viewerId ? [{ field: 'participantesIds', op: 'array-contains', value: viewerId }] : []),
    ],
    orderBy: [
      { field: 'actualizadoEn', direction: 'desc' },
      { field: '__name__', direction: 'desc' },
    ],
    limit: pageSize + 1,
    startAfter: cursor
      ? [
          { timestampValue: cursor.actualizadoEn },
          {
            referenceValue: `projects/${projectId}/databases/(default)/documents/${COLECCION_CONVERSACIONES}/${cursor.id}`,
          },
        ]
      : [],
  });
  const page = buildConversationPage({ conversations, pageSize });

  return {
    ...page,
    conversations: await Promise.all(
      page.conversations.map((conversation) =>
        conversationToUi(conversation, null, viewerId, chatStore, {
          summaryOnly: true,
          includeReceipts: false,
          // La lista tambien necesita la cara: es lo primero que se ve. Cuesta
          // poco, porque las fotos se guardan en memoria un rato y una lista
          // repite a las mismas personas una y otra vez.
          enrichParticipantPhotos: true,
        })
      )
    ),
  };
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

  // De paso, lo que lleva demasiado tiempo sin contestar en este buzon. Es un
  // extra: si falla, el contador se devuelve igual.
  const buzonDelResumen = buzonPorIdMiembros(viewerId);

  if (buzonDelResumen) {
    await avisarDeLoQueNadieContesta(buzonDelResumen, conversations).catch((error) => {
      console.warn(
        JSON.stringify({
          event: 'chat_notification_error',
          stage: 'buzon_sin_responder',
          ...toSafeChatErrorMetric(error),
        })
      );
    });
  }

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
  // EL PRIMER MENSAJE TAMBIEN CUENTA COMO NO LEIDO.
  //
  // Se ponia a cero para TODOS, incluido a quien le acababan de escribir. Asi
  // que estrenar una conversacion no le encendia la bolita a nadie: el mensaje
  // llegaba y en el menu no aparecia nada. Solo se notaba a partir del segundo,
  // que ya pasa por otro camino y si lo cuenta.
  //
  // Quien escribe lo tiene leido —acaba de escribirlo—; los demas no.
  const noLeidosPorIdMiembros = Object.fromEntries(
    participantesIds.map((id) => [
      String(id),
      primerMensaje && Number(id) !== Number(primerMensaje.remitenteIdMiembros) ? 1 : 0,
    ])
  );

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
    // El reloj de lo que nadie contesta, desde el primer mensaje: escribirle a
    // la Tienda estrena la conversacion, y ese mensaje cuenta como los demas.
    ...(primerMensaje
      ? (relojSinResponder({
          participantesIds,
          remitenteIdMiembros: primerMensaje.remitenteIdMiembros,
          enviadoEn: primerMensaje.enviadoEn,
          esBuzon: esBuzonCompartido,
        }) ?? {})
      : {}),
  };

  await chatStore.setDocument(conversationPath, conversationDoc);
  if (primerMensaje) {
    await chatStore.setDocument(
      `${conversationPath}/${SUBCOLECCION_MENSAJES}/${primerMensaje.idMensaje}`,
      primerMensaje
    );
    await anotarRespuestaDeBuzon(chatActor, idConversacion, primerMensaje.idMensaje);

    // El aviso es un extra. El mensaje ya esta guardado: si el aviso falla, se
    // anota y se sigue. Tumbar un mensaje entregado por su notificacion es
    // exactamente el fallo que se acaba de arreglar.
    await createMessageNotifications({
      conversation: conversationDoc,
      message: primerMensaje,
    }).catch((error) => {
      console.warn(
        JSON.stringify({
          event: 'chat_notification_error',
          stage: 'first_message',
          ...toSafeChatErrorMetric(error),
        })
      );
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

  // EL RELOJ DE LO QUE NADIE CONTESTA. Solo en las conversaciones de un buzon:
  // arranca con el primer mensaje sin respuesta y se para cuando el buzon
  // contesta. De el salen los avisos de "lleva una hora esperando" (ver
  // `chat-buzon-sin-responder.mjs`).
  const relojDelBuzon = relojSinResponder({
    participantesIds: asArray(existingConversation.participantesIds),
    sinResponderDesde: existingConversation.sinResponderDesde,
    remitenteIdMiembros: messageDoc.remitenteIdMiembros,
    enviadoEn: messageDoc.enviadoEn,
    esBuzon: esBuzonCompartido,
  });

  await chatStore.setDocument(
    `${conversationPath}/${SUBCOLECCION_MENSAJES}/${messageDoc.idMensaje}`,
    messageDoc
  );
  await anotarRespuestaDeBuzon(chatActor, conversationId, messageDoc.idMensaje);
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
      ...(relojDelBuzon ?? {}),
    },
    { merge: true }
  );

  await createMessageNotifications({
    conversation: { ...existingConversation, idConversacion: conversationId },
    message: messageDoc,
  }).catch((error) => {
    console.warn(
      JSON.stringify({
        event: 'chat_notification_error',
        stage: 'message',
        ...toSafeChatErrorMetric(error),
      })
    );
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
  const hadUnreadMessages = Number(existingConversation.noLeidosPorIdMiembros?.[String(viewerId)]) > 0;
  const writes = [
    ...(receipt?.changed ? [{ type: 'set', path: receipt.path, data: receipt.data }] : []),
    ...(hadUnreadMessages
      ? [
          {
            type: 'set',
            path: `${COLECCION_CONVERSACIONES}/${conversationId}`,
            data: { noLeidosPorIdMiembros },
            merge: true,
          },
        ]
      : []),
  ];

  if (writes.length) await chatStore.commitWrites(writes);

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
        adjuntosAfectados: asArray(messageData.adjuntosOriginales ?? messageData.adjuntos).length,
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
    const nextReactions = toggleChatReaction(currentReactions, reactionKey, normalizedReaction);

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
      ultimoMensaje: isLastMessage
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
  auditDetails = {},
}) {
  const changedAt = nowIso();
  const conversationPath = `${COLECCION_CONVERSACIONES}/${conversationId}`;
  const actor = asArray(conversation.participantes).find(
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
    details: { participantes: participantIds.length, ...auditDetails },
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
  historyVisibility = CHAT_GROUP_HISTORY_VISIBILITY.NONE,
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
    const previousTypingAt = existingConversation.escribiendoPorIdMiembros?.[viewerKey];
    const previousTypingTime = new Date(previousTypingAt ?? 0).getTime();
    const isRecentTypingHeartbeat =
      isTyping && Number.isFinite(previousTypingTime) && Date.now() - previousTypingTime < 2000;

    if ((!isTyping && !previousTypingAt) || isRecentTypingHeartbeat) return null;

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
    const receipt = await updateConversationReceipt({
      conversationId,
      conversation: existingConversation,
      chatActor,
      chatStore,
    });

    return { id: String(conversationId), delivered: true, updated: Boolean(receipt?.changed) };
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
    // CON LOS BUZONES DENTRO. Sin ellos, agregar la Tienda Virtual o la Oficina
    // Nacional a un grupo no encontraba a nadie con ese numero y la operacion se
    // caia entera con un "no se pudo actualizar el chat": un buzon no sale del
    // padron, se añade aparte, como en el resto de la ruta.
    const contacts = await conLosBuzones(getAllContacts([...members, ...firestoreProfiles]));

    const nuevosParticipantes = candidatos
      .map((candidato) => resolveParticipantFromContacts(candidato, contacts))
      // A quien no se reconoce se le deja fuera y ya. Preguntandole el numero a
      // un `null`, un solo candidato raro tumbaba la peticion entera.
      .filter(
        (member) =>
          member?.idMiembros &&
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
    const addedAt = nowIso();
    const ocultoAntesPorIdMiembros = applyAddedParticipantHistoryVisibility({
      currentCutoffs: existingConversation.ocultoAntesPorIdMiembros,
      participantIds: nuevosParticipantes.map((member) => member.idMiembros),
      visibility: historyVisibility,
      now: addedAt,
    });

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
        ocultoAntesPorIdMiembros,
        tipoConversacion: 'GRUPAL',
        administradoresIds: asArray(existingConversation.administradoresIds).length
          ? existingConversation.administradoresIds
          : [existingConversation.creadoPorIdMiembros],
      },
      systemText: `${actorName} agregó a ${nuevosParticipantes.map(buildNombreCompleto).join(', ')} al grupo. ${
        historyVisibility === CHAT_GROUP_HISTORY_VISIBILITY.ALL
          ? 'Podrá ver todo el historial.'
          : historyVisibility === CHAT_GROUP_HISTORY_VISIBILITY.LAST_HOUR
            ? 'Podrá ver los mensajes de la última hora.'
            : 'No podrá ver los mensajes anteriores.'
      }`,
      auditDetails: { historialCompartido: historyVisibility },
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
  const operation = startChatOperation({ method: 'GET', url: req.url });
  let operationError = null;

  try {
    const { searchParams } = new URL(req.url);
    const chatActor = await autenticarActorDelChat(
      req,
      searchParams.get('idMiembros') ?? searchParams.get('sessionMemberId')
    );
    assertChatPermission(chatActor, CHAT_PERMISSIONS.VIEW);
    ensureFirestore();

    const endpoint = searchParams.get('endpoint');
    const conversationId = searchParams.get('conversationId');
    const viewerIdMiembros = chatActor.idMiembros;
    const chatStore = createChatStore(chatActor);

    if (endpoint === 'contacts') {
      const [members, firestoreProfiles] = await Promise.all([
        getMembersFromApi(),
        getMembersFromFirestoreProfiles(),
      ]);

      // Las fotos NO vienen en el padron: viven en Firestore. Sin esto, el
      // buscador del chat enseñaba a todo el mundo con el monigote gris.
      return Response.json(
        {
          contacts: await conSusFotos(
            await conLosBuzones(getAllContacts([...members, ...firestoreProfiles]))
          ),
        },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    if (endpoint === 'unread-summary') {
      return Response.json(await getUnreadSummary(viewerIdMiembros, chatStore));
    }

    if (endpoint === 'conversations') {
      const page = await getConversations(viewerIdMiembros, chatStore, {
        cursor: searchParams.get('cursor'),
        pageSize: searchParams.get('limit'),
      });

      return Response.json(page);
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
        conversation: await conQuienContesto(
          await conversationToUi(conversation, null, viewerIdMiembros, chatStore),
          chatActor
        ),
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

      const conResponsables = await conQuienContesto(
        { id: conversationId, messages: olderMessages.map(messageToUi) },
        chatActor
      );

      return Response.json({ messages: conResponsables.messages });
    }

    if (endpoint === 'mark-as-seen') {
      await markAsSeen(conversationId, chatActor, chatStore);

      return Response.json({ success: true });
    }

    return Response.json({ message: 'Endpoint de chat inválido.' }, { status: 400 });
  } catch (error) {
    operationError = error;
    return buildChatErrorResponse(error, operation.requestId, 'No se pudo procesar el chat.');
  } finally {
    operation.finish({ error: operationError });
  }
}

export async function POST(req) {
  const operation = startChatOperation({ method: 'POST', url: req.url });
  let operationError = null;

  try {
    const body = await req.json();
    const chatActor = await autenticarActorDelChat(req, body?.idMiembros);
    ensureFirestore();
    const chatStore = createChatStore(chatActor);

    const conversation = await conQuienContesto(
      await createConversation(body.conversationData, chatActor, chatStore),
      chatActor
    );

    return Response.json({ conversation });
  } catch (error) {
    operationError = error;
    return buildChatErrorResponse(error, operation.requestId, 'No se pudo crear la conversación.');
  } finally {
    operation.finish({ error: operationError });
  }
}

export async function PUT(req) {
  const operation = startChatOperation({ method: 'PUT', url: req.url });
  let operationError = null;

  try {
    const body = await req.json();
    const chatActor = await autenticarActorDelChat(req, body?.idMiembros);
    ensureFirestore();
    const chatStore = createChatStore(chatActor);

    const conversation = await conQuienContesto(
      await addMessage(body.conversationId, body.messageData, chatActor, chatStore),
      chatActor
    );

    return Response.json({ conversation });
  } catch (error) {
    operationError = error;
    return buildChatErrorResponse(error, operation.requestId, 'No se pudo enviar el mensaje.');
  } finally {
    operation.finish({ error: operationError });
  }
}

export async function PATCH(req) {
  const operation = startChatOperation({ method: 'PATCH', url: req.url });
  let operationError = null;

  try {
    const body = await req.json();
    const chatActor = await autenticarActorDelChat(req, body?.idMiembros);
    ensureFirestore();
    const chatStore = createChatStore(chatActor);

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
          historyVisibility: body.historyVisibility,
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

    return Response.json({ conversation: await conQuienContesto(conversation, chatActor) });
  } catch (error) {
    operationError = error;
    return buildChatErrorResponse(error, operation.requestId, 'No se pudo actualizar el chat.');
  } finally {
    operation.finish({ error: operationError });
  }
}
