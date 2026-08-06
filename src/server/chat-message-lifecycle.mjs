import {
  ChatMessageValidationError,
  normalizeChatMessageEditText,
} from './chat-message-model.mjs';

export const CHAT_MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1_000;
export const CHAT_MESSAGE_RESTORE_WINDOW_MS = 5 * 60 * 1_000;

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const timestampMs = (value) => new Date(value ?? '').getTime();

export const collectChatAttachmentPaths = (messages = []) =>
  Array.from(
    new Set(
      asArray(messages)
        .flatMap((message) => [
          ...asArray(message?.adjuntos ?? message?.attachments),
          ...asArray(message?.adjuntosOriginales ?? message?.attachmentsOriginal),
        ])
        .map((attachment) => String(attachment?.storagePath ?? '').trim())
        .filter((path) => /^chat\/[^/]+\/(imagenes|archivos)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/.test(path))
    )
  );

export const createChatAuditEvent = ({
  action,
  actorIdMiembros,
  messageId = null,
  now = new Date().toISOString(),
  details = {},
  randomUUID = () => crypto.randomUUID(),
} = {}) => {
  const idEvento = `evento_${randomUUID()}`;

  return {
    idEvento,
    accion: String(action ?? '').trim(),
    actorIdMiembros: Number(actorIdMiembros),
    idMensaje: messageId ? String(messageId) : null,
    creadoEn: now,
    detalle: asObject(details),
  };
};

export const applyChatMessageLifecycleAction = ({
  action,
  message = {},
  text = '',
  now = new Date().toISOString(),
} = {}) => {
  const nowMs = timestampMs(now);
  const sentAtMs = timestampMs(message.enviadoEn ?? message.createdAt);

  if (action === 'edit') {
    if (message.eliminado) {
      throw new ChatMessageValidationError(
        'No se puede editar un mensaje eliminado.',
        'CHAT_MESSAGE_ALREADY_DELETED'
      );
    }

    return {
      ...message,
      texto: normalizeChatMessageEditText(text),
      editado: true,
      actualizadoEn: now,
    };
  }

  if (action === 'delete') {
    if (message.eliminado) {
      throw new ChatMessageValidationError(
        'El mensaje ya está eliminado.',
        'CHAT_MESSAGE_ALREADY_DELETED'
      );
    }
    if (
      !Number.isFinite(nowMs) ||
      !Number.isFinite(sentAtMs) ||
      nowMs < sentAtMs ||
      nowMs - sentAtMs > CHAT_MESSAGE_DELETE_WINDOW_MS
    ) {
      throw new ChatMessageValidationError(
        'No se pueden eliminar mensajes después de 1 hora de enviados.',
        'CHAT_MESSAGE_DELETE_WINDOW_EXPIRED'
      );
    }

    return {
      ...message,
      textoOriginal: message.textoOriginal ?? message.texto,
      tipoContenidoOriginal: message.tipoContenidoOriginal ?? message.tipoContenido,
      adjuntosOriginales: message.adjuntosOriginales ?? message.adjuntos ?? [],
      texto: 'Mensaje eliminado',
      tipoContenido: 'text',
      adjuntos: [],
      reacciones: {},
      eliminado: true,
      eliminadoEn: now,
      actualizadoEn: now,
    };
  }

  if (action === 'restore') {
    const deletedAtMs = timestampMs(message.eliminadoEn);

    if (!message.eliminado || !Number.isFinite(deletedAtMs)) {
      throw new ChatMessageValidationError(
        'El mensaje no está disponible para restauración.',
        'CHAT_MESSAGE_NOT_DELETED'
      );
    }
    if (!Number.isFinite(nowMs) || nowMs < deletedAtMs || nowMs - deletedAtMs > CHAT_MESSAGE_RESTORE_WINDOW_MS) {
      throw new ChatMessageValidationError(
        'El tiempo para deshacer la eliminación terminó.',
        'CHAT_MESSAGE_RESTORE_WINDOW_EXPIRED'
      );
    }

    return {
      ...message,
      texto: message.textoOriginal ?? '',
      tipoContenido: message.tipoContenidoOriginal ?? 'text',
      adjuntos: message.adjuntosOriginales ?? [],
      eliminado: false,
      eliminadoEn: null,
      actualizadoEn: now,
    };
  }

  throw new ChatMessageValidationError(
    'La acción del ciclo de vida del mensaje no es válida.',
    'CHAT_MESSAGE_ACTION_INVALID'
  );
};

export const getPersonalClearCutoff = (conversation = {}, viewerIdMiembros) =>
  asObject(conversation.ocultoAntesPorIdMiembros)[String(viewerIdMiembros)] ?? null;
