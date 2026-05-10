import {
  doc,
  query,
  where,
  setDoc,
  getDoc,
  getDocs,
  orderBy,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';

import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { COLECCIONES_NOTIFICACIONES } from 'src/utils/firebase-notificaciones';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

// ----------------------------------------------------------------------

const COLECCION_CONVERSACIONES = 'conversaciones_chat';
const SUBCOLECCION_MENSAJES = 'mensajes';
const COLECCIONES_USUARIOS = ['users', 'usuarios_roles', 'admins'];
const MEMBERS_API_URL = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';
const COLECCION_FOTOS = 'fotos';
const MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1000;

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
  const id = String(normalizedMember.idMiembros ?? '');

  return {
    ...normalizedMember,
    id,
    name: buildNombreCompleto(normalizedMember),
    role: normalizedMember.estatusMiembro,
    email: normalizedMember.correo,
    address: normalizedMember.direccion,
    phoneNumber: normalizedMember.telefono,
    status: 'offline',
    lastActivity: nowIso(),
  };
};

const getAllContacts = (members = []) => {
  const contacts = new Map();

  const mergeContact = (currentContact, nextContact) => ({
    ...nextContact,
    ...currentContact,
    avatarUrl: currentContact.avatarUrl || nextContact.avatarUrl,
    status: currentContact.status || nextContact.status,
    lastActivity: currentContact.lastActivity || nextContact.lastActivity,
  });

  members.forEach((member) => {
    const contact = memberToContact(member);

    if (contact.id) {
      contacts.set(contact.id, contacts.has(contact.id) ? mergeContact(contacts.get(contact.id), contact) : contact);
    }
  });

  return Array.from(contacts.values());
};

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
  const normalizedParticipant = normalizeMember(participant);

  if (normalizedParticipant.idMiembros) {
    return normalizedParticipant;
  }

  const participantKeys = new Set(getMemberLookupKeys(participant));

  if (!participantKeys.size) {
    return normalizedParticipant;
  }

  const contact = contacts.find((item) =>
    getMemberLookupKeys(item).some((key) => participantKeys.has(key))
  );

  return normalizeMember({ ...participant, ...contact });
};

async function resolveConversationParticipants(conversationData = {}) {
  const rawParticipants = asArray(conversationData.participantes ?? conversationData.participants);
  const participants = rawParticipants.map(normalizeMember);

  if (participants.filter((member) => member.idMiembros).length >= 2) {
    return participants.filter((member) => member.idMiembros);
  }

  const [members, firestoreProfiles] = await Promise.all([
    getMembersFromApi().catch(() => []),
    getMembersFromFirestoreProfiles().catch(() => []),
  ]);
  const contacts = getAllContacts([...members, ...firestoreProfiles]);

  return rawParticipants
    .map((participant) => resolveParticipantFromContacts(participant, contacts))
    .filter((member) => member.idMiembros);
}

const messageToFirestore = (message = {}, fallbackSender = {}) => {
  const remitenteIdMiembros =
    toNumberOrNull(message.remitenteIdMiembros ?? message.senderId) ??
    toNumberOrNull(fallbackSender.idMiembros);
  const enviadoEn = message.enviadoEn ?? message.createdAt ?? nowIso();

  return {
    idMensaje: message.idMensaje ?? message.id ?? crypto.randomUUID(),
    texto: message.texto ?? message.body ?? '',
    tipoContenido: message.tipoContenido ?? message.contentType ?? 'text',
    remitenteIdMiembros,
    remitente: normalizeMember({
      ...fallbackSender,
      idMiembros: remitenteIdMiembros,
    }),
    adjuntos: asArray(message.adjuntos ?? message.attachments),
    enviadoEn,
    actualizadoEn: message.actualizadoEn ?? enviadoEn,
    editado: Boolean(message.editado),
    eliminado: Boolean(message.eliminado),
    eliminadoEn: message.eliminadoEn ?? null,
    respuestaA: message.respuestaA ?? message.replyTo ?? null,
    reacciones: message.reacciones ?? message.reactions ?? {},
    metadatos: message.metadatos ?? message.metadata ?? {},
    vistoPorIdMiembros: message.vistoPorIdMiembros ?? {},
  };
};

const resolveMessageSender = ({ messageData = {}, conversation = {} }) => {
  const participants = asArray(conversation.participantes);
  const participantIds = asArray(conversation.participantesIds);
  const senderId = messageData.remitenteIdMiembros ?? messageData.senderId;
  const directMatch = participants.find(
    (participant) => Number(participant.idMiembros) === Number(senderId)
  );

  if (directMatch) return directMatch;

  const normalizedSender = String(senderId ?? '').trim().toLowerCase();

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

const messageToUi = (message = {}) => ({
  id: String(message.idMensaje ?? message.id ?? ''),
  body: message.texto ?? message.body ?? '',
  contentType: message.tipoContenido ?? message.contentType ?? 'text',
  attachments: asArray(message.adjuntos ?? message.attachments),
  bodyOriginal: message.textoOriginal ?? message.bodyOriginal ?? null,
  contentTypeOriginal: message.tipoContenidoOriginal ?? message.contentTypeOriginal ?? null,
  attachmentsOriginal: asArray(message.adjuntosOriginales ?? message.attachmentsOriginal),
  createdAt: message.enviadoEn ?? message.createdAt ?? nowIso(),
  senderId: String(message.remitenteIdMiembros ?? message.senderId ?? ''),
  eliminado: Boolean(message.eliminado),
  replyTo: message.respuestaA ?? message.replyTo ?? null,
  reactions: message.reacciones ?? message.reactions ?? {},
  metadata: message.metadatos ?? message.metadata ?? {},
});

const contactWithCurrentPhoto = async (member = {}) => {
  const contact = memberToContact(member);
  const avatarUrl = await getMemberPhotoUrl(contact.idMiembros, contact.avatarUrl);

  return {
    ...contact,
    avatarUrl,
  };
};

const conversationToUi = async (conversation = {}, messages = null, viewerIdMiembros = null) => {
  const loadedMessages =
    messages ??
    (await getMessages(conversation.idConversacion ?? conversation.id)).map((message) =>
      messageToUi(message)
    );
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
    participants: await Promise.all(asArray(conversation.participantes).map(contactWithCurrentPhoto)),
    messages: loadedMessages,
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

  return asArray(normalized.data).map(normalizeMember).filter((member) => member.idMiembros);
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
        const isAdmin =
          collectionName === 'admins' || role === 'admin' || role === 'administrador';

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

  const snapshot = await getDoc(doc(FIRESTORE, COLECCION_FOTOS, `miembro_${memberId}_perfil`)).catch(
    () => null
  );

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

  return profileWithPhoto?.photoURL || profileWithPhoto?.avatarUrl || profileWithPhoto?.urlFoto || '';
}

async function createMessageNotifications({ conversation = {}, message = {} }) {
  if (!message.texto) return;

  const senderId = Number(message.remitenteIdMiembros);
  const mutedByIdMiembros = conversation.silenciadoPorIdMiembros ?? {};
  const recipientsIds = asArray(conversation.participantesIds).filter(
    (idMiembros) =>
      Number(idMiembros) !== senderId && !mutedByIdMiembros[String(idMiembros)]
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

      return setDoc(
        doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId),
        {
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
        },
        { merge: true }
      );
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
        const isAdmin =
          collectionName === 'admins' || role === 'admin' || role === 'administrador';

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

async function getMessages(idConversacion) {
  if (!idConversacion) return [];

  const messagesQuery = query(
    collection(FIRESTORE, COLECCION_CONVERSACIONES, String(idConversacion), SUBCOLECCION_MENSAJES),
    orderBy('enviadoEn', 'asc')
  );
  const snapshot = await getDocs(messagesQuery);

  return snapshot.docs.map((item) => item.data());
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

async function getConversationDoc(idConversacion) {
  const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES, String(idConversacion));
  const snapshot = await getDoc(conversationRef);

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getConversations(viewerIdMiembros = null) {
  const viewerId = toNumberOrNull(viewerIdMiembros);
  const conversationsQuery = viewerId
    ? query(
        collection(FIRESTORE, COLECCION_CONVERSACIONES),
        where('eliminada', '==', false),
        where('participantesIds', 'array-contains', viewerId)
      )
    : query(collection(FIRESTORE, COLECCION_CONVERSACIONES), where('eliminada', '==', false));
  const snapshot = await getDocs(conversationsQuery);

  return Promise.all(
    snapshot.docs.map(async (item) =>
      conversationToUi({ idConversacion: item.id, ...item.data() }, null, viewerId)
    )
  );
}

async function createConversation(conversationData = {}) {
  const participantes = await resolveConversationParticipants(conversationData);
  const participantesIds = [...new Set(participantes.map((member) => member.idMiembros))];
  const tipoConversacion =
    conversationData.tipoConversacion ??
    (conversationData.type === 'GROUP' || participantesIds.length > 2 ? 'GRUPAL' : 'INDIVIDUAL');
  const idConversacion = buildConversationId({
    tipoConversacion,
    participantesIds,
    providedId: conversationData.idConversacion ?? conversationData.id,
  });

  if (!idConversacion || participantesIds.length < 2) {
    throw new Error('La conversación necesita al menos dos participantes con idMiembros.');
  }

  const primerMensaje = messageToFirestore(
    asArray(conversationData.messages)[0],
    resolveMessageSender({
      messageData: asArray(conversationData.messages)[0],
      conversation: { participantes, participantesIds },
    })
  );
  const existingConversation = await getConversationDoc(idConversacion);

  if (existingConversation) {
    if (primerMensaje.texto) {
      return addMessage(idConversacion, primerMensaje);
    }

    return conversationToUi(existingConversation);
  }

  const creadoEn = conversationData.creadoEn ?? conversationData.createdAt ?? nowIso();
  const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES, idConversacion);
  const noLeidosPorIdMiembros = Object.fromEntries(participantesIds.map((id) => [String(id), 0]));

  const conversationDoc = {
    idConversacion,
    tipoConversacion,
    participantesIds,
    participantes,
    creadoPorIdMiembros: primerMensaje.remitenteIdMiembros ?? participantesIds[0],
    creadoEn,
    actualizadoEn: primerMensaje.enviadoEn ?? creadoEn,
    ultimoMensaje: {
      idMensaje: primerMensaje.idMensaje,
      texto: primerMensaje.texto,
      tipoContenido: primerMensaje.tipoContenido,
      remitenteIdMiembros: primerMensaje.remitenteIdMiembros,
      enviadoEn: primerMensaje.enviadoEn,
    },
    noLeidosPorIdMiembros,
    activa: true,
    eliminada: false,
  };

  await setDoc(conversationRef, conversationDoc);
  await setDoc(
    doc(conversationRef, SUBCOLECCION_MENSAJES, primerMensaje.idMensaje),
    primerMensaje
  );

  await createMessageNotifications({ conversation: conversationDoc, message: primerMensaje }).catch(
    (error) => {
      console.error('[chat] no se pudo crear la notificación del primer mensaje', error);
    }
  );

  return conversationToUi(conversationDoc, [messageToUi(primerMensaje)]);
}

async function addMessage(conversationId, messageData = {}, viewerIdMiembros = null) {
  const existingConversation = await getConversationDoc(conversationId);

  if (!existingConversation) {
    throw new Error('La conversación no existe.');
  }

  const sender = resolveMessageSender({
    messageData,
    conversation: existingConversation,
  });
  const messageDoc = messageToFirestore(messageData, sender);

  if (!messageDoc.remitenteIdMiembros) {
    throw new Error('El mensaje necesita remitenteIdMiembros válido.');
  }

  const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES, String(conversationId));
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

  await setDoc(doc(conversationRef, SUBCOLECCION_MENSAJES, messageDoc.idMensaje), messageDoc);
  await setDoc(
    conversationRef,
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
    (await getMessages(conversationId)).map(messageToUi),
    viewerIdMiembros
  );
}

async function markAsSeen(conversationId, viewerIdMiembros = null) {
  const existingConversation = await getConversationDoc(conversationId);

  if (!existingConversation) return null;

  const viewerId = toNumberOrNull(viewerIdMiembros);
  const noLeidosPorIdMiembros = { ...(existingConversation.noLeidosPorIdMiembros ?? {}) };

  if (viewerId) {
    noLeidosPorIdMiembros[String(viewerId)] = 0;
  } else {
    Object.keys(noLeidosPorIdMiembros).forEach((idMiembros) => {
      noLeidosPorIdMiembros[idMiembros] = 0;
    });
  }

  await setDoc(
    doc(FIRESTORE, COLECCION_CONVERSACIONES, String(conversationId)),
    { noLeidosPorIdMiembros },
    { merge: true }
  );

  return { ...existingConversation, noLeidosPorIdMiembros };
}

async function updateMessageAction({
  conversationId,
  messageId,
  action,
  viewerIdMiembros = null,
  reaction = '👍',
  text = '',
}) {
  const existingConversation = await getConversationDoc(conversationId);

  if (!existingConversation) {
    throw new Error('La conversación no existe.');
  }

  const messageRef = doc(
    FIRESTORE,
    COLECCION_CONVERSACIONES,
    String(conversationId),
    SUBCOLECCION_MENSAJES,
    String(messageId)
  );
  const messageSnapshot = await getDoc(messageRef);

  if (!messageSnapshot.exists()) {
    throw new Error('El mensaje no existe.');
  }

  const messageData = messageSnapshot.data();
  let nextMessage = messageData;

  if (action === 'delete') {
    if (Number(messageData.remitenteIdMiembros) !== Number(viewerIdMiembros)) {
      throw new Error('Solo puedes eliminar tus propios mensajes.');
    }

    const sentAtTime = new Date(messageData.enviadoEn ?? messageData.createdAt).getTime();

    if (!Number.isFinite(sentAtTime) || Date.now() - sentAtTime > MESSAGE_DELETE_WINDOW_MS) {
      throw new Error('No se pueden eliminar mensajes despues de 1 hora de enviados.');
    }

    nextMessage = {
      ...messageData,
      textoOriginal: messageData.textoOriginal ?? messageData.texto,
      tipoContenidoOriginal: messageData.tipoContenidoOriginal ?? messageData.tipoContenido,
      adjuntosOriginales: messageData.adjuntosOriginales ?? messageData.adjuntos,
      texto: 'Mensaje eliminado',
      eliminado: true,
      eliminadoEn: nowIso(),
      actualizadoEn: nowIso(),
    };
  }

  if (action === 'restore') {
    nextMessage = {
      ...messageData,
      texto: messageData.textoOriginal ?? messageData.texto,
      tipoContenido: messageData.tipoContenidoOriginal ?? messageData.tipoContenido,
      adjuntos: messageData.adjuntosOriginales ?? messageData.adjuntos,
      eliminado: false,
      eliminadoEn: null,
      actualizadoEn: nowIso(),
    };
  }

  if (action === 'edit') {
    nextMessage = {
      ...messageData,
      texto: text || messageData.texto,
      textoOriginal: null,
      editado: true,
      actualizadoEn: nowIso(),
    };
  }

  if (action === 'react') {
    const reactionKey = String(viewerIdMiembros || 'usuario');
    const currentReactions = messageData.reacciones ?? {};
    const currentReaction = currentReactions[reactionKey];
    const nextReactions = { ...currentReactions };

    if (currentReaction === reaction) {
      delete nextReactions[reactionKey];
    } else {
      nextReactions[reactionKey] = reaction;
    }

    nextMessage = {
      ...messageData,
      reacciones: nextReactions,
      actualizadoEn: nowIso(),
    };
  }

  await setDoc(messageRef, nextMessage, { merge: true });

  if (String(existingConversation?.ultimoMensaje?.idMensaje) === String(messageId)) {
    await setDoc(
      doc(FIRESTORE, COLECCION_CONVERSACIONES, String(conversationId)),
      {
        ultimoMensaje: {
          ...(existingConversation.ultimoMensaje || {}),
          texto: nextMessage.texto,
        },
        actualizadoEn: nowIso(),
      },
      { merge: true }
    );
  }

  return conversationToUi(
    {
      ...existingConversation,
      idConversacion: conversationId,
      ultimoMensaje:
        String(existingConversation?.ultimoMensaje?.idMensaje) === String(messageId)
          ? { ...(existingConversation.ultimoMensaje || {}), texto: nextMessage.texto }
          : existingConversation.ultimoMensaje,
    },
    (await getMessages(conversationId)).map(messageToUi),
    viewerIdMiembros
  );
}

async function updateConversationAction({
  conversationId,
  action,
  viewerIdMiembros = null,
  comment = '',
}) {
  const existingConversation = await getConversationDoc(conversationId);

  if (!existingConversation) {
    throw new Error('La conversacion no existe.');
  }

  const conversationRef = doc(FIRESTORE, COLECCION_CONVERSACIONES, String(conversationId));
  const viewerId = toNumberOrNull(viewerIdMiembros);

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

    await setDoc(conversationRef, { silenciadoPorIdMiembros }, { merge: true });

    return conversationToUi(
      { ...existingConversation, silenciadoPorIdMiembros },
      (await getMessages(conversationId)).map(messageToUi),
      viewerId
    );
  }

  if (action === 'clear') {
    const messages = await getMessages(conversationId);

    await Promise.all(
      messages.map((message) =>
        deleteDoc(
          doc(
            FIRESTORE,
            COLECCION_CONVERSACIONES,
            String(conversationId),
            SUBCOLECCION_MENSAJES,
            String(message.idMensaje)
          )
        )
      )
    );

    await setDoc(
      conversationRef,
      {
        actualizadoEn: nowIso(),
        ultimoMensaje: null,
        noLeidosPorIdMiembros: {},
      },
      { merge: true }
    );

    return conversationToUi(
      { ...existingConversation, actualizadoEn: nowIso(), ultimoMensaje: null, noLeidosPorIdMiembros: {} },
      [],
      viewerId
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

        return setDoc(doc(FIRESTORE, COLECCIONES_NOTIFICACIONES.notificaciones, notificationId), {
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
      (await getMessages(conversationId)).map(messageToUi),
      viewerId
    );
  }

  throw new Error('Accion de conversacion invalida.');
}

export async function GET(req) {
  try {
    ensureFirestore();

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    const conversationId = searchParams.get('conversationId');
    const viewerIdMiembros = toNumberOrNull(searchParams.get('idMiembros'));

    if (endpoint === 'contacts') {
      const [members, firestoreProfiles] = await Promise.all([
        getMembersFromApi(),
        getMembersFromFirestoreProfiles(),
      ]);

      return Response.json({ contacts: getAllContacts([...members, ...firestoreProfiles]) });
    }

    if (endpoint === 'conversations') {
      const conversations = await getConversations(viewerIdMiembros);

      return Response.json({ conversations });
    }

    if (endpoint === 'conversation') {
      const conversation = await getConversationDoc(conversationId);

      if (!conversation) {
        return Response.json({ message: 'Conversación no encontrada.' }, { status: 404 });
      }

      if (
        viewerIdMiembros &&
        !asArray(conversation.participantesIds).some(
          (idMiembros) => Number(idMiembros) === Number(viewerIdMiembros)
        )
      ) {
        return Response.json(
          { message: 'No tienes acceso a esta conversación.' },
          { status: 403 }
        );
      }

      return Response.json({
        conversation: await conversationToUi(conversation, null, viewerIdMiembros),
      });
    }

    if (endpoint === 'mark-as-seen') {
      await markAsSeen(conversationId, viewerIdMiembros);

      return Response.json({ success: true });
    }

    return Response.json({ message: 'Endpoint de chat inválido.' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { message: error?.message || 'Error procesando el chat.' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    ensureFirestore();

    const body = await req.json();
    const conversation = await createConversation(body.conversationData);

    return Response.json({ conversation });
  } catch (error) {
    return Response.json(
      { message: error?.message || 'Error creando la conversación.' },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    ensureFirestore();

    const body = await req.json();
    const conversation = await addMessage(body.conversationId, body.messageData, body.idMiembros);

    return Response.json({ conversation });
  } catch (error) {
    return Response.json(
      { message: error?.message || 'Error enviando el mensaje.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    ensureFirestore();

    const body = await req.json();
    const conversation = ['toggle-mute', 'report', 'clear'].includes(body.action)
      ? await updateConversationAction({
          conversationId: body.conversationId,
          action: body.action,
          viewerIdMiembros: toNumberOrNull(body.idMiembros),
          comment: body.comment,
        })
      : await updateMessageAction({
          conversationId: body.conversationId,
          messageId: body.messageId,
          action: body.action,
          viewerIdMiembros: toNumberOrNull(body.idMiembros),
          reaction: body.reaction,
          text: body.text,
        });

    return Response.json({ conversation });
  } catch (error) {
    return Response.json(
      { message: error?.message || 'Error actualizando el mensaje.' },
      { status: 500 }
    );
  }
}
