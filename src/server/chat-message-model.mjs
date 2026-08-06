import { toPublicChatContact } from './chat-contact-core.mjs';
import { normalizeEmojiReaction } from '../utils/chat-reaction-core.mjs';

export const CHAT_MESSAGE_MODEL_VERSION = 2;
export const CHAT_MESSAGE_MAX_TEXT_LENGTH = 20_000;
export const CHAT_MESSAGE_MAX_ATTACHMENTS = 10;

const CONTENT_TYPES = new Set(['text', 'image', 'file', 'system']);
const DELIVERY_STATES = new Set(['enviando', 'enviado', 'entregado', 'visto', 'error']);
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
]);
const SAFE_MESSAGE_ID = /^[a-zA-Z0-9_-]{1,160}$/;
const SAFE_FILE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/;

export class ChatMessageValidationError extends Error {
  constructor(message, code = 'CHAT_MESSAGE_INVALID') {
    super(message);
    this.name = 'ChatMessageValidationError';
    this.code = code;
    this.status = 400;
  }
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const cleanText = (value) =>
  String(value ?? '')
    .replace(/\0/g, '')
    .trim();
const positiveMemberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeIso = (value, fallback) => {
  const parsed = value instanceof Date ? value : new Date(value ?? '');

  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
};

const normalizeUniqueMemberIds = (value, limit = 250) =>
  Array.from(new Set(asArray(value).map(positiveMemberId).filter(Boolean))).slice(0, limit);

const safeWebOrAppUrl = (value) => {
  const candidate = cleanText(value);

  if (candidate.startsWith('/dashboard/')) return candidate;

  try {
    const url = new URL(candidate);

    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const normalizeReply = (value) => {
  const reply = asObject(value);
  const id = cleanText(reply.idMensaje ?? reply.id);

  if (!id || !SAFE_MESSAGE_ID.test(id)) return null;

  return {
    id,
    body: cleanText(reply.texto ?? reply.body).slice(0, 500),
    senderId: String(positiveMemberId(reply.remitenteIdMiembros ?? reply.senderId) ?? ''),
  };
};

const normalizeReactions = (value) =>
  Object.fromEntries(
    Object.entries(asObject(value))
      .map(([memberId, reaction]) => [positiveMemberId(memberId), normalizeEmojiReaction(reaction)])
      .filter(([memberId, reaction]) => memberId && reaction)
      .slice(0, 250)
      .map(([memberId, reaction]) => [String(memberId), reaction])
  );

const normalizeSeenMap = (value) => {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      normalizeUniqueMemberIds(value).map((memberId) => [String(memberId), true])
    );
  }

  return Object.fromEntries(
    Object.entries(asObject(value))
      .map(([memberId, seenAt]) => [positiveMemberId(memberId), seenAt])
      .filter(([memberId]) => memberId)
      .slice(0, 250)
      .map(([memberId, seenAt]) => [String(memberId), seenAt === true ? true : cleanText(seenAt)])
  );
};

export const normalizeChatMessageEditText = (value) => {
  const text = cleanText(value);

  if (!text) {
    throw new ChatMessageValidationError('El mensaje editado no puede estar vacío.');
  }
  if (text.length > CHAT_MESSAGE_MAX_TEXT_LENGTH) {
    throw new ChatMessageValidationError(
      `El mensaje supera el límite de ${CHAT_MESSAGE_MAX_TEXT_LENGTH} caracteres.`,
      'CHAT_MESSAGE_TOO_LONG'
    );
  }

  return text;
};

export const normalizeChatReaction = (value) => {
  const reaction = normalizeEmojiReaction(value);

  if (!reaction) {
    throw new ChatMessageValidationError('La reacción no es válida.', 'CHAT_REACTION_INVALID');
  }

  return reaction;
};

const normalizeMetadata = (value) => {
  const metadata = asObject(value);
  const normalized = {};
  const ordenId = cleanText(metadata.ordenId).slice(0, 160);
  const numeroOrden = cleanText(metadata.numeroOrden).slice(0, 160);

  if (ordenId) normalized.ordenId = ordenId;
  if (numeroOrden) normalized.numeroOrden = numeroOrden;

  const sharedFile = asObject(metadata.sharedFile);
  const sharedFileName = cleanText(sharedFile.name).slice(0, 255);
  const sharedFileUrl = safeWebOrAppUrl(sharedFile.url);

  if (sharedFileName && sharedFileUrl) {
    normalized.sharedFile = {
      name: sharedFileName,
      url: sharedFileUrl,
      ...(cleanText(sharedFile.message) && {
        message: cleanText(sharedFile.message).slice(0, 2_000),
      }),
    };
  }

  return normalized;
};

const normalizeAttachment = ({ attachment, conversationId, contentType }) => {
  const source = asObject(attachment);
  const storagePath = cleanText(source.storagePath);
  const normalizedConversationId = cleanText(conversationId);
  const expectedFolder = contentType === 'image' ? 'imagenes' : 'archivos';
  const expectedPrefix = `chat/${normalizedConversationId}/${expectedFolder}/`;
  const filename = storagePath.slice(expectedPrefix.length);
  const mimeType = cleanText(source.tipo ?? source.type);
  const size = Number(source.tamano ?? source.size);
  const allowedMimeTypes = contentType === 'image' ? IMAGE_MIME_TYPES : FILE_MIME_TYPES;
  const maxSize = contentType === 'image' ? 8 * 1024 * 1024 : 10 * 1024 * 1024;
  const url = safeWebOrAppUrl(source.url ?? source.downloadURL);

  if (
    !normalizedConversationId ||
    !storagePath.startsWith(expectedPrefix) ||
    !SAFE_FILE_NAME.test(filename)
  ) {
    throw new ChatMessageValidationError(
      'El archivo no pertenece a la conversación activa.',
      'CHAT_ATTACHMENT_PATH_INVALID'
    );
  }

  if (
    !allowedMimeTypes.has(mimeType) ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > maxSize
  ) {
    throw new ChatMessageValidationError(
      'El tipo o tamaño del archivo adjunto no está permitido.',
      'CHAT_ATTACHMENT_TYPE_INVALID'
    );
  }

  if (!url) {
    throw new ChatMessageValidationError(
      'El archivo adjunto no tiene una URL segura.',
      'CHAT_ATTACHMENT_URL_INVALID'
    );
  }

  return {
    id: cleanText(source.id).slice(0, 255) || filename,
    nombre: cleanText(source.nombre ?? source.name).slice(0, 255) || filename,
    nombreOriginal: cleanText(source.nombreOriginal).slice(0, 255) || filename,
    tipo: mimeType,
    tamano: size,
    tamanoOriginal: Math.max(0, Number(source.tamanoOriginal) || size),
    optimizado: Boolean(source.optimizado),
    fechaCarga: normalizeIso(source.fechaCarga, new Date().toISOString()),
    origen: 'producto_restringido',
    almacenamiento: 'firebase',
    storagePath,
    url,
    downloadURL: url,
  };
};

const normalizeAttachments = ({ value, conversationId, contentType }) => {
  const attachments = asArray(value);

  if (attachments.length > CHAT_MESSAGE_MAX_ATTACHMENTS) {
    throw new ChatMessageValidationError(
      `Un mensaje admite hasta ${CHAT_MESSAGE_MAX_ATTACHMENTS} archivos adjuntos.`,
      'CHAT_ATTACHMENT_LIMIT_EXCEEDED'
    );
  }

  if (attachments.length && !['image', 'file'].includes(contentType)) {
    throw new ChatMessageValidationError(
      'Los archivos adjuntos requieren un tipo de mensaje de imagen o archivo.',
      'CHAT_ATTACHMENT_CONTENT_TYPE_INVALID'
    );
  }

  return attachments.map((attachment) =>
    normalizeAttachment({ attachment, conversationId, contentType })
  );
};

export const createChatMessageDocument = ({
  message = {},
  fallbackSender = {},
  conversationId,
  now = new Date().toISOString(),
  randomUUID = () => crypto.randomUUID(),
} = {}) => {
  const idMensaje = cleanText(message.idMensaje ?? message.id ?? randomUUID());
  const texto = cleanText(message.texto ?? message.body);
  const tipoContenido = cleanText(message.tipoContenido ?? message.contentType) || 'text';
  const remitenteIdMiembros =
    positiveMemberId(message.remitenteIdMiembros ?? message.senderId) ??
    positiveMemberId(fallbackSender.idMiembros);
  const enviadoEn = normalizeIso(message.enviadoEn ?? message.createdAt, now);

  if (!SAFE_MESSAGE_ID.test(idMensaje)) {
    throw new ChatMessageValidationError('El identificador del mensaje no es válido.');
  }
  if (!CONTENT_TYPES.has(tipoContenido)) {
    throw new ChatMessageValidationError('El tipo de mensaje no es válido.');
  }
  if (!remitenteIdMiembros) {
    throw new ChatMessageValidationError('No se pudo identificar al remitente.');
  }
  if (texto.length > CHAT_MESSAGE_MAX_TEXT_LENGTH) {
    throw new ChatMessageValidationError(
      `El mensaje supera el límite de ${CHAT_MESSAGE_MAX_TEXT_LENGTH} caracteres.`,
      'CHAT_MESSAGE_TOO_LONG'
    );
  }

  const adjuntos = normalizeAttachments({
    value: message.adjuntos ?? message.attachments,
    conversationId,
    contentType: tipoContenido,
  });

  if (!texto && !adjuntos.length && tipoContenido !== 'system') {
    throw new ChatMessageValidationError('El mensaje no puede estar vacío.', 'CHAT_MESSAGE_EMPTY');
  }
  if (tipoContenido === 'system' && !texto) {
    throw new ChatMessageValidationError('El mensaje del sistema no puede estar vacío.');
  }

  const eliminado = Boolean(message.eliminado);

  return {
    idMensaje,
    versionModelo: CHAT_MESSAGE_MODEL_VERSION,
    texto,
    tipoContenido,
    remitenteIdMiembros,
    remitente: toPublicChatContact({ ...fallbackSender, idMiembros: remitenteIdMiembros }),
    adjuntos,
    enviadoEn,
    actualizadoEn: normalizeIso(message.actualizadoEn, enviadoEn),
    editado: Boolean(message.editado),
    eliminado,
    eliminadoEn: message.eliminadoEn ? normalizeIso(message.eliminadoEn, null) : null,
    respuestaA: normalizeReply(message.respuestaA ?? message.replyTo),
    mencionesIds: normalizeUniqueMemberIds(message.mencionesIds ?? message.mentionIds),
    reacciones: eliminado ? {} : normalizeReactions(message.reacciones ?? message.reactions),
    metadatos: normalizeMetadata(message.metadatos ?? message.metadata),
    estadoEntrega: DELIVERY_STATES.has(message.estadoEntrega) ? message.estadoEntrega : 'enviado',
    entregadoAIdMiembros: normalizeUniqueMemberIds(message.entregadoAIdMiembros),
    vistoPorIdMiembros: normalizeSeenMap(message.vistoPorIdMiembros),
  };
};

export const chatMessageToUi = (message = {}, now = new Date().toISOString()) => ({
  id: String(message.idMensaje ?? message.id ?? ''),
  versionModelo: Number(message.versionModelo) || 1,
  body: message.texto ?? message.body ?? '',
  contentType: message.tipoContenido ?? message.contentType ?? 'text',
  attachments: asArray(message.adjuntos ?? message.attachments),
  bodyOriginal: message.textoOriginal ?? message.bodyOriginal ?? null,
  contentTypeOriginal: message.tipoContenidoOriginal ?? message.contentTypeOriginal ?? null,
  attachmentsOriginal: asArray(message.adjuntosOriginales ?? message.attachmentsOriginal),
  createdAt: message.enviadoEn ?? message.createdAt ?? now,
  updatedAt: message.actualizadoEn ?? message.updatedAt ?? message.enviadoEn ?? now,
  senderId: String(message.remitenteIdMiembros ?? message.senderId ?? ''),
  editado: Boolean(message.editado),
  eliminado: Boolean(message.eliminado),
  eliminadoEn: message.eliminadoEn ?? null,
  replyTo: message.respuestaA ?? message.replyTo ?? null,
  mentionIds: normalizeUniqueMemberIds(message.mencionesIds ?? message.mentionIds),
  reactions: message.eliminado ? {} : normalizeReactions(message.reacciones ?? message.reactions),
  metadata: normalizeMetadata(message.metadatos ?? message.metadata),
  deliveryStatus: DELIVERY_STATES.has(message.estadoEntrega) ? message.estadoEntrega : 'enviado',
  deliveredToMemberIds: normalizeUniqueMemberIds(message.entregadoAIdMiembros),
  seenByMemberIds: Object.keys(normalizeSeenMap(message.vistoPorIdMiembros)).map(Number),
});
