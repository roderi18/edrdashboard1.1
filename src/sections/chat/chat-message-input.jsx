import { uuidv4 } from 'minimal-shared/utils';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { logChatClientError, getChatErrorMessage } from 'src/utils/chat-error.mjs';
import {
  uploadFilesToStorage,
  buildStorageFileName,
  deleteUploadedFilesFromStorage,
} from 'src/utils/firebase-file-storage';

import {
  setTyping,
  sendMessage,
  editMessage,
  addLocalMessage,
  removeLocalMessage,
  createConversation,
} from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { SelectorDeEmojis } from 'src/components/emoji/selector-de-emojis';

import { buildChatDraftKey } from './utils/productivity.mjs';
import { initialConversation } from './utils/initial-conversation';

// ----------------------------------------------------------------------

const MAX_IMAGE_FILES = 10;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_DOCUMENT_FILES = 10;
const MAX_DOCUMENT_TOTAL_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
]);
// Los emojis viven ahora en `src/catalogs/emojis.mjs`, con su nombre en español
// y su buscador. Aqui eran cadenas separadas por espacios, sin nombre, y estaban
// duplicados en otros dos sitios.

const isZipOrPdf = (file) => {
  const name = String(file?.name || '').toLowerCase();

  return ALLOWED_DOCUMENT_TYPES.has(file?.type) || name.endsWith('.pdf') || name.endsWith('.zip');
};

const formatFileSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const buildAttachmentMessage = ({ upload, senderId, contentType }) => ({
  id: uuidv4(),
  attachments: [upload],
  body: contentType === 'image' ? upload.url : upload.nombre,
  contentType,
  createdAt: new Date().toISOString(),
  senderId: String(senderId),
});

export function ChatMessageInput({
  authReady = true,
  disabled,
  recipients,
  groupName,
  participants = [],
  currentContact,
  onAddRecipients,
  replyMessage,
  editingMessage,
  onClearReply,
  onClearEditing,
  selectedConversationId,
  sharedMessage,
  onConsumeSharedMessage,
}) {
  const router = useRouter();

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastTypingSentAtRef = useRef(0);
  const typingStopTimeoutRef = useRef(null);
  const typingRequestRef = useRef(Promise.resolve());
  const uploadAbortControllerRef = useRef(null);
  const pendingAttachmentsRef = useRef([]);
  const hydratedDraftKeyRef = useRef(null);
  const inputRef = useRef(null);

  const [message, setMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const draftKey = useMemo(
    () =>
      buildChatDraftKey({
        currentMemberId: currentContact.idMiembros ?? currentContact.id,
        conversationId: selectedConversationId,
        recipientIds: recipients.map((recipient) => recipient.idMiembros ?? recipient.id),
      }),
    [currentContact.id, currentContact.idMiembros, recipients, selectedConversationId]
  );

  const mentionCandidates =
    mentionQuery !== null
      ? participants.filter((participant) =>
          participant.name?.toLowerCase().includes(mentionQuery.toLowerCase())
        )
      : [];

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.body || '');
    }
  }, [editingMessage]);

  useEffect(() => {
    if (!sharedMessage) return;

    setMessage((currentMessage) =>
      currentMessage.trim() ? `${currentMessage}\n${sharedMessage}` : sharedMessage
    );
    onConsumeSharedMessage?.();
  }, [onConsumeSharedMessage, sharedMessage]);

  useEffect(
    () => () => {
      uploadAbortControllerRef.current?.abort();
      const abandonedUploads = pendingAttachmentsRef.current
        .filter((item) => ['error', 'cancelled'].includes(item.status) && item.upload)
        .map((item) => item.upload);
      if (abandonedUploads.length) void deleteUploadedFilesFromStorage(abandonedUploads);
      pendingAttachmentsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined' || editingMessage || sharedMessage) return;

    hydratedDraftKeyRef.current = draftKey;
    setMessage(window.localStorage.getItem(draftKey) ?? '');
  }, [draftKey, editingMessage, sharedMessage]);

  useEffect(() => {
    if (
      !draftKey ||
      typeof window === 'undefined' ||
      editingMessage ||
      hydratedDraftKeyRef.current !== draftKey
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (message.trim()) window.localStorage.setItem(draftKey, message);
      else window.localStorage.removeItem(draftKey);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [draftKey, editingMessage, message]);

  const updateAttachmentState = useCallback((attachmentId, changes) => {
    setPendingAttachments((currentItems) =>
      currentItems.map((item) =>
        item.id === attachmentId
          ? { ...item, ...(typeof changes === 'function' ? changes(item) : changes) }
          : item
      )
    );
  }, []);

  const buildUploadCallbacks = useCallback(
    (attachments) => ({
      onProgress: ({ index, progress, state }) => {
        const attachmentId = attachments[index]?.id;
        if (attachmentId) {
          updateAttachmentState(attachmentId, {
            progress,
            status: state === 'success' ? 'uploaded' : 'uploading',
          });
        }
      },
      signal: uploadAbortControllerRef.current?.signal,
    }),
    [updateAttachmentState]
  );

  const { messageData, conversationData } = initialConversation({
    message,
    recipients,
    me: currentContact,
    replyMessage,
    groupName,
  });

  const queueTypingUpdate = useCallback(
    (isTyping) => {
      if (!authReady || !selectedConversationId || !currentContact.idMiembros) return;

      typingRequestRef.current = typingRequestRef.current
        .catch(() => undefined)
        .then(() => setTyping(selectedConversationId, currentContact.idMiembros, isTyping));
    },
    [authReady, currentContact.idMiembros, selectedConversationId]
  );

  const stopTyping = useCallback(() => {
    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    typingStopTimeoutRef.current = null;
    lastTypingSentAtRef.current = 0;
    queueTypingUpdate(false);
  }, [queueTypingUpdate]);

  useEffect(
    () => () => {
      if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
      if (authReady && selectedConversationId && currentContact.idMiembros) {
        typingRequestRef.current = typingRequestRef.current
          .catch(() => undefined)
          .then(() => setTyping(selectedConversationId, currentContact.idMiembros, false));
      }
    },
    [authReady, currentContact.idMiembros, selectedConversationId]
  );

  const handleOpenImages = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleOpenFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChangeMessage = useCallback(
    (event) => {
      const value = event.target.value;
      setMessage(value);

      const mentionMatch = value.match(/(?:^|\s)@([^@\n]*)$/u);
      setMentionQuery(mentionMatch ? mentionMatch[1].trimStart() : null);

      if (!value.trim()) {
        stopTyping();
      } else if (authReady && selectedConversationId && currentContact.idMiembros) {
        const now = Date.now();
        if (now - lastTypingSentAtRef.current > 10000) {
          lastTypingSentAtRef.current = now;
          queueTypingUpdate(true);
        }

        if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = setTimeout(stopTyping, 5000);
      }
    },
    [authReady, currentContact.idMiembros, queueTypingUpdate, selectedConversationId, stopTyping]
  );

  const handleInsertEmoji = useCallback((emoji) => {
    setMessage((currentMessage) => `${currentMessage}${emoji}`);
  }, []);

  const handleSelectMention = useCallback((participant) => {
    setMessage((currentMessage) =>
      currentMessage.replace(/@([^@\n]*)$/u, `@${participant.name} `)
    );
    setMentionQuery(null);
    inputRef.current?.focus();
  }, []);

  const handleSubmitMessage = useCallback(async () => {
    if (isUploading || (!message.trim() && !pendingAttachments.length)) return;

    const textToSend = message;
    const attachmentsToSend = pendingAttachments;
    const deliveredAttachmentIds = new Set();
    let activeConversationId = selectedConversationId;
    let localImageMessageId = null;

    stopTyping();
    setMessage('');
    uploadAbortControllerRef.current = new AbortController();

    if (attachmentsToSend.length) {
      setIsUploading(true);
      setPendingAttachments((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          error: null,
          progress: item.upload ? 100 : 0,
          status: item.upload ? 'uploaded' : 'uploading',
        }))
      );
    }

    try {
      if (editingMessage && selectedConversationId) {
        onClearEditing?.();
        await editMessage(
          selectedConversationId,
          editingMessage.id,
          textToSend,
          currentContact.idMiembros
        );
        onClearReply?.();
        return;
      }

      if (attachmentsToSend.length) {
        if (!activeConversationId) {
          const res = await createConversation(
            { ...conversationData, messages: [] },
            currentContact.idMiembros
          );

          activeConversationId = res.conversation.id;
          router.push(`${paths.dashboard.chat}?id=${activeConversationId}`);
          onAddRecipients([]);
        }

        const imageAttachments = attachmentsToSend.filter((item) => item.contentType === 'image');
        const fileAttachments = attachmentsToSend.filter((item) => item.contentType === 'file');

        if (imageAttachments.length) {
          const imageMessageId = imageAttachments[0].localMessageId || uuidv4();
          localImageMessageId = imageMessageId;
          const localImageMessage = {
            id: imageMessageId,
            attachments: imageAttachments.map((item) => ({
              ...(item.upload || {}),
              id: item.upload?.id || item.id,
              nombre: item.upload?.nombre || item.file.name,
              nombreOriginal: item.file.name,
              tipo: item.upload?.tipo || item.file.type,
              tamano: item.upload?.tamano || item.file.size,
              previewUrl: item.upload?.url ? undefined : item.previewUrl,
            })),
            body: imageAttachments[0].upload?.url || imageAttachments[0].previewUrl,
            contentType: 'image',
            createdAt: new Date().toISOString(),
            senderId: String(currentContact.idMiembros || currentContact.id),
            estadoEnvio: 'enviando',
          };

          await addLocalMessage(activeConversationId, localImageMessage);

          updateAttachmentState(imageAttachments[0].id, { localMessageId: imageMessageId });
          const missingImages = imageAttachments.filter((item) => !item.upload);
          const newUploads = missingImages.length
            ? await uploadFilesToStorage({
                files: missingImages.map((item) => item.file),
                storagePathBuilder: (file, index) =>
                  `chat/${activeConversationId}/imagenes/${buildStorageFileName(file, index)}`,
                metadataBuilder: () => ({
                  modulo: 'chat',
                  tipo: 'imagen',
                  idConversacion: String(activeConversationId),
                  remitenteIdMiembros: String(currentContact.idMiembros || ''),
                }),
                ...buildUploadCallbacks(missingImages),
              })
            : [];
          const uploadByAttachmentId = new Map(
            missingImages.map((item, index) => [item.id, newUploads[index]])
          );
          const uploads = imageAttachments.map(
            (item) => item.upload || uploadByAttachmentId.get(item.id)
          );

          imageAttachments.forEach((item, index) => {
            updateAttachmentState(item.id, {
              upload: uploads[index],
              localMessageId: imageMessageId,
              progress: 100,
              status: 'uploaded',
            });
          });

          await sendMessage(
            activeConversationId,
            {
              ...localImageMessage,
              attachments: uploads,
              body: uploads[0]?.url || uploads[0]?.downloadURL || localImageMessage.body,
            },
            currentContact.idMiembros
          );

          imageAttachments.forEach((item) => {
            deliveredAttachmentIds.add(item.id);
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          });
          setPendingAttachments((currentItems) =>
            currentItems.filter((item) => !deliveredAttachmentIds.has(item.id))
          );
        }

        if (fileAttachments.length) {
          const missingFiles = fileAttachments.filter((item) => !item.upload);
          const newUploads = missingFiles.length
            ? await uploadFilesToStorage({
                files: missingFiles.map((item) => item.file),
                storagePathBuilder: (file, index) =>
                  `chat/${activeConversationId}/archivos/${buildStorageFileName(file, index)}`,
                metadataBuilder: () => ({
                  modulo: 'chat',
                  tipo: 'archivo',
                  idConversacion: String(activeConversationId),
                  remitenteIdMiembros: String(currentContact.idMiembros || ''),
                }),
                ...buildUploadCallbacks(missingFiles),
              })
            : [];
          const uploadByAttachmentId = new Map(
            missingFiles.map((item, index) => [item.id, newUploads[index]])
          );

          fileAttachments.forEach((item) => {
            const upload = item.upload || uploadByAttachmentId.get(item.id);
            updateAttachmentState(item.id, { upload, progress: 100, status: 'uploaded' });
          });

          for (const item of fileAttachments) {
            const upload = item.upload || uploadByAttachmentId.get(item.id);
            const attachmentMessage = buildAttachmentMessage({
              upload,
              contentType: 'file',
              senderId: currentContact.idMiembros || currentContact.id,
            });
            await sendMessage(activeConversationId, attachmentMessage, currentContact.idMiembros);
            deliveredAttachmentIds.add(item.id);
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            setPendingAttachments((currentItems) =>
              currentItems.filter((currentItem) => currentItem.id !== item.id)
            );
          }
        }
      }

      if (textToSend && activeConversationId) {
        await sendMessage(
          activeConversationId,
          { ...messageData, body: textToSend },
          currentContact.idMiembros
        );
      } else if (textToSend) {
        const res = await createConversation(
          {
            ...conversationData,
            messages: [{ ...messageData, body: textToSend }],
          },
          currentContact.idMiembros
        );
        router.push(`${paths.dashboard.chat}?id=${res.conversation.id}`);

        onAddRecipients([]);
      }

      onClearReply?.();
      if (draftKey && typeof window !== 'undefined') window.localStorage.removeItem(draftKey);
    } catch (error) {
      const errorMessage = getChatErrorMessage(error, 'No se pudo enviar el mensaje.');
      logChatClientError('send-message', error);
      toast.error(errorMessage);
      const cancelled = error?.cancelled || error?.code === 'chat/upload-cancelled';
      if (localImageMessageId && activeConversationId) {
        await removeLocalMessage(activeConversationId, localImageMessageId).catch(() => undefined);
      }
      setPendingAttachments((currentItems) =>
        currentItems
          .filter((item) => !deliveredAttachmentIds.has(item.id))
          .map((item) => ({
            ...item,
            status: cancelled ? 'cancelled' : 'error',
            error: errorMessage,
          }))
      );
      setMessage(textToSend);
    } finally {
      uploadAbortControllerRef.current = null;
      setIsUploading(false);
    }
  }, [
    buildUploadCallbacks,
    conversationData,
    currentContact.idMiembros,
    currentContact.id,
    editingMessage,
    message,
    messageData,
    onAddRecipients,
    onClearEditing,
    onClearReply,
    pendingAttachments,
    router,
    selectedConversationId,
    stopTyping,
    isUploading,
    updateAttachmentState,
    draftKey,
  ]);

  const handleSendMessage = useCallback(
    async (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;

      event.preventDefault();
      await handleSubmitMessage();
    },
    [handleSubmitMessage]
  );

  const handleUploadImages = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    const imageFiles = files.filter((file) => ALLOWED_IMAGE_TYPES.has(String(file.type || '')));

    if (imageFiles.length !== files.length) {
      toast.error('Solo puedes enviar imágenes JPG, PNG, WebP o GIF.');
      return;
    }

    if (imageFiles.length > MAX_IMAGE_FILES) {
      toast.error('Puedes enviar un máximo de 10 imágenes a la vez.');
      return;
    }

    if (imageFiles.some((file) => file.size > MAX_IMAGE_SIZE)) {
      toast.error('Cada imagen puede pesar hasta 8 MB.');
      return;
    }

    setPendingAttachments((currentItems) => {
      const currentImages = currentItems.filter((item) => item.contentType === 'image').length;
      if (currentImages + imageFiles.length > MAX_IMAGE_FILES) {
        toast.error('Puedes enviar un máximo de 10 imágenes a la vez.');
        return currentItems;
      }

      return [
        ...currentItems,
        ...imageFiles.map((file, index) => ({
          id: `image-${uuidv4()}-${index}`,
          file,
          contentType: 'image',
          previewUrl: URL.createObjectURL(file),
          progress: 0,
          status: 'pending',
        })),
      ];
    });
  }, []);

  const handleUploadFiles = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    if (!files.every(isZipOrPdf)) {
      toast.error('Solo puedes enviar archivos PDF o ZIP.');
      return;
    }

    if (files.length > MAX_DOCUMENT_FILES) {
      toast.error('Puedes enviar un máximo de 10 documentos a la vez.');
      return;
    }

    const selectedSize = files.reduce((total, file) => total + Number(file.size || 0), 0);

    if (selectedSize > MAX_DOCUMENT_TOTAL_SIZE) {
      toast.error('Los archivos PDF/ZIP no pueden superar 10 MB en conjunto.');
      return;
    }

    setPendingAttachments((currentItems) => {
      const currentFiles = currentItems.filter((item) => item.contentType === 'file');
      const currentSize = currentFiles.reduce(
        (total, item) => total + Number(item.file?.size || 0),
        0
      );

      if (currentFiles.length + files.length > MAX_DOCUMENT_FILES) {
        toast.error('Puedes enviar un máximo de 10 documentos a la vez.');
        return currentItems;
      }

      if (currentSize + selectedSize > MAX_DOCUMENT_TOTAL_SIZE) {
        toast.error('Los archivos PDF/ZIP no pueden superar 10 MB en conjunto.');
        return currentItems;
      }

      return [
        ...currentItems,
        ...files.map((file, index) => ({
          id: `file-${uuidv4()}-${index}`,
          file,
          contentType: 'file',
          previewUrl:
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
              ? URL.createObjectURL(file)
              : null,
          progress: 0,
          status: 'pending',
        })),
      ];
    });
  }, []);

  const handleRemoveAttachment = useCallback((item) => {
    if (item.upload) void deleteUploadedFilesFromStorage([item.upload]);
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setPendingAttachments((currentItems) =>
      currentItems.filter((currentItem) => currentItem.id !== item.id)
    );
  }, []);

  const handleCancelUpload = useCallback(() => {
    uploadAbortControllerRef.current?.abort();
  }, []);

  return (
    <>
      {replyMessage && (
        <Box
          sx={{
            px: 2,
            py: 1,
            gap: 1,
            display: 'flex',
            alignItems: 'center',
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
          }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Respondiendo a
            </Typography>
            <Typography noWrap variant="body2">
              {replyMessage.body}
            </Typography>
          </Box>

          <IconButton size="small" onClick={onClearReply}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Box>
      )}

      {editingMessage && (
        <Box
          sx={{
            px: 2,
            py: 1,
            gap: 1,
            display: 'flex',
            alignItems: 'center',
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
          }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Editando mensaje
            </Typography>
            <Typography noWrap variant="body2">
              {editingMessage.body}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={() => {
              onClearEditing?.();
              setMessage('');
            }}
          >
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Box>
      )}

      {!!pendingAttachments.length && (
        <Box
          sx={{
            px: 2,
            py: 1,
            gap: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            borderTop: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            bgcolor: 'background.neutral',
          }}
        >
          {pendingAttachments.map((item) => (
            <Box
              key={item.id}
              sx={{
                gap: 0.75,
                px: 1,
                py: 0.75,
                minWidth: 0,
                maxWidth: item.contentType === 'image' ? 300 : 260,
                display: 'flex',
                borderRadius: 1,
                alignItems: 'center',
                bgcolor: 'background.paper',
              }}
            >
              {item.contentType === 'image' ? (
                <Box
                  component="button"
                  type="button"
                  onClick={() => setPreviewAttachment(item)}
                  sx={{
                    p: 0,
                    width: 48,
                    height: 48,
                    border: 0,
                    flexShrink: 0,
                    cursor: 'pointer',
                    overflow: 'hidden',
                    borderRadius: 1,
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Box
                    component="img"
                    loading="lazy"
                    decoding="async"
                    src={item.previewUrl}
                    alt={item.file.name}
                    sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                  />
                </Box>
              ) : item.previewUrl ? (
                <IconButton
                  size="small"
                  aria-label={`Vista previa de ${item.file.name}`}
                  onClick={() => setPreviewAttachment(item)}
                >
                  <Iconify icon="solar:file-text-bold" width={22} />
                </IconButton>
              ) : (
                <Iconify icon="solar:file-bold" width={20} />
              )}

              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography noWrap variant="body2">
                  {item.file.name}
                </Typography>
                <Typography
                  noWrap
                  variant="caption"
                  sx={{
                    display: 'block',
                    color:
                      item.status === 'error'
                        ? 'error.main'
                        : item.status === 'cancelled'
                          ? 'warning.main'
                          : 'text.secondary',
                  }}
                >
                  {item.status === 'uploading' && `Subiendo ${item.progress || 0}%`}
                  {item.status === 'uploaded' && 'Listo para enviar'}
                  {item.status === 'error' && 'Error; puedes reintentar'}
                  {item.status === 'cancelled' && 'Carga cancelada'}
                  {(!item.status || item.status === 'pending') && formatFileSize(item.file.size)}
                </Typography>
                {item.status === 'uploading' && (
                  <LinearProgress
                    variant="determinate"
                    value={item.progress || 0}
                    aria-label={`Progreso de ${item.file.name}`}
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>

              <IconButton
                size="small"
                disabled={isUploading}
                aria-label={`Quitar ${item.file.name}`}
                onClick={() => handleRemoveAttachment(item)}
              >
                <Iconify icon="mingcute:close-line" width={16} />
              </IconButton>
            </Box>
          ))}

          {isUploading && (
            <Button size="small" color="warning" onClick={handleCancelUpload}>
              Cancelar carga
            </Button>
          )}

          {!isUploading &&
            pendingAttachments.some((item) => ['error', 'cancelled'].includes(item.status)) && (
              <Button size="small" onClick={handleSubmitMessage}>
                Reintentar
              </Button>
            )}
        </Box>
      )}

      <Popover
        open={Boolean(previewAttachment)}
        anchorEl={imageInputRef.current}
        onClose={() => setPreviewAttachment(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 1,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 1.5,
            },
          },
        }}
      >
        {previewAttachment && (
          <Box>
            {previewAttachment.contentType === 'image' ? (
              <Box
                component="img"
                loading="lazy"
                decoding="async"
                src={previewAttachment.previewUrl}
                alt={previewAttachment.file.name}
                sx={{
                  width: 420,
                  maxWidth: 'calc(100vw - 64px)',
                  maxHeight: 420,
                  display: 'block',
                  borderRadius: 1,
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Box
                component="iframe"
                src={previewAttachment.previewUrl}
                title={`Vista previa de ${previewAttachment.file.name}`}
                sx={{ width: 560, maxWidth: 'calc(100vw - 64px)', height: 420, border: 0 }}
              />
            )}
            <Typography noWrap variant="caption" sx={{ mt: 1, display: 'block' }}>
              {previewAttachment.file.name} · {formatFileSize(previewAttachment.file.size)}
            </Typography>
          </Box>
        )}
      </Popover>

      <InputBase
        inputRef={inputRef}
        multiline
        maxRows={5}
        name="chat-message"
        id="chat-message-input"
        value={message}
        onKeyDown={handleSendMessage}
        onChange={handleChangeMessage}
        onBlur={stopTyping}
        placeholder="Escribe un mensaje"
        inputProps={{ 'aria-label': 'Escribir mensaje. Enter envía y Mayús más Enter crea una línea.' }}
        disabled={disabled || isUploading}
        startAdornment={
          <IconButton
            aria-label="Abrir selector de emojis"
            aria-expanded={emojiPickerOpen}
            onClick={(event) => setEmojiAnchorEl(event.currentTarget)}
          >
            <Iconify icon="eva:smiling-face-fill" />
          </IconButton>
        }
        endAdornment={
          <Box sx={{ flexShrink: 0, display: 'flex' }}>
            <Tooltip title="Imágenes JPG, PNG, WebP o GIF; máximo 10 y 8 MB cada una">
              <span>
                <IconButton
                  disabled={disabled || isUploading}
                  aria-label="Adjuntar imágenes"
                  onClick={handleOpenImages}
                >
                  <Iconify icon="solar:gallery-add-bold" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Documentos PDF o ZIP; máximo 10 y 10 MB en conjunto">
              <span>
                <IconButton
                  disabled={disabled || isUploading}
                  aria-label="Adjuntar documentos"
                  onClick={handleOpenFiles}
                >
                  <Iconify icon="eva:attach-2-fill" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Mensajes de voz próximamente">
              <span>
                <IconButton disabled aria-label="Mensajes de voz próximamente">
                  <Iconify icon="solar:microphone-bold" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              color="primary"
              disabled={isUploading || (!message.trim() && !pendingAttachments.length)}
              aria-label={isUploading ? 'Enviando archivos' : 'Enviar mensaje'}
              onClick={handleSubmitMessage}
            >
              <Iconify icon="solar:plain-bold" />
            </IconButton>
          </Box>
        }
        sx={[
          (theme) => ({
            px: 1,
            py: 0.5,
            minHeight: 56,
            maxHeight: 160,
            flexShrink: 0,
            borderTop: `solid 1px ${theme.vars.palette.divider}`,
          }),
        ]}
      />

      <Popover
        open={!!mentionCandidates.length}
        anchorEl={inputRef.current}
        onClose={() => setMentionQuery(null)}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 240, maxHeight: 240 } } }}
      >
        <Box role="listbox" aria-label="Sugerencias de menciones">
          {mentionCandidates.map((participant) => (
            <Box
              key={participant.idMiembros ?? participant.id}
              component="button"
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => handleSelectMention(participant)}
              sx={{
                p: 1,
                gap: 1,
                width: 1,
                border: 0,
                display: 'flex',
                cursor: 'pointer',
                textAlign: 'left',
                alignItems: 'center',
                bgcolor: 'transparent',
                typography: 'body2',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {participant.name}
            </Box>
          ))}
        </Box>
      </Popover>

      <SelectorDeEmojis
        open={emojiPickerOpen}
        anchorEl={emojiAnchorEl}
        onClose={() => setEmojiAnchorEl(null)}
        onSelectEmoji={handleInsertEmoji}
      />

      <input
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        ref={imageInputRef}
        style={{ display: 'none' }}
        onChange={handleUploadImages}
      />

      <input
        multiple
        type="file"
        accept=".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleUploadFiles}
      />
    </>
  );
}
