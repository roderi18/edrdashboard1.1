import { uuidv4 } from 'minimal-shared/utils';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { uploadFilesToStorage, buildStorageFileName } from 'src/utils/firebase-file-storage';

import { sendMessage, editMessage, addLocalMessage, createConversation } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { initialConversation } from './utils/initial-conversation';

// ----------------------------------------------------------------------

const MAX_IMAGE_FILES = 10;
const MAX_DOCUMENT_TOTAL_SIZE = 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
]);
export const CHAT_EMOJI_CATEGORIES = [
  {
    label: 'Caras',
    emojis:
      '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🫣 🤗 🤔 🫡 🤭 🫢 🫠 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕'.split(
        ' '
      ),
  },
  {
    label: 'Gestos',
    emojis:
      '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🖐️ ✋ 🤚 👋 🤙 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 👌 👈 👉 👆 👇 ☝️ ✋ 🫵'.split(
        ' '
      ),
  },
  {
    label: 'Personas',
    emojis:
      '👶 🧒 👦 👧 🧑 👨 👩 🧔 👱 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 👷 💂 🕵️ 👩‍⚕️ 👨‍⚕️ 👩‍🏫 👨‍🏫 👩‍🍳 👨‍🍳 👩‍💻 👨‍💻 👩‍🎤 👨‍🎤 👩‍🚀 👨‍🚀 🧙 🧚 🧛 🧜 🧝 🧞 🧟'.split(
        ' '
      ),
  },
  {
    label: 'Corazones',
    emojis:
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 💯 💢 💥 💫 💦 💨 🕳️'.split(
        ' '
      ),
  },
  {
    label: 'Animales',
    emojis:
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🦟 🦗 🕷️ 🦂 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈'.split(
        ' '
      ),
  },
  {
    label: 'Comida',
    emojis:
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂'.split(
        ' '
      ),
  },
  {
    label: 'Actividad',
    emojis:
      '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🎮 🕹️ 🎲 ♟️ 🎯 🎳'.split(
        ' '
      ),
  },
  {
    label: 'Viajes',
    emojis:
      '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🏍️ 🛵 🚲 🛴 🛹 🛼 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🚁 🚀 🛸 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🛟 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️'.split(
        ' '
      ),
  },
  {
    label: 'Objetos',
    emojis:
      '⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🧱'.split(
        ' '
      ),
  },
  {
    label: 'Símbolos',
    emojis:
      '✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ❕ ❔ ❗ ❓ ‼️ ⁉️ 💬 💭 🗯️ ♠️ ♥️ ♦️ ♣️ 🃏 🀄 🎴 🔇 🔈 🔉 🔊 📢 📣 🔔 🔕 🎵 🎶 💹 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓'.split(
        ' '
      ),
  },
  {
    label: 'Banderas',
    emojis:
      '🇩🇴 🇺🇸 🇵🇷 🇪🇸 🇲🇽 🇨🇴 🇻🇪 🇨🇺 🇭🇹 🇵🇦 🇨🇷 🇭🇳 🇳🇮 🇸🇻 🇬🇹 🇧🇷 🇦🇷 🇨🇱 🇵🇪 🇪🇨 🇺🇾 🇵🇾 🇧🇴 🇨🇦 🇬🇧 🇫🇷 🇩🇪 🇮🇹 🇵🇹 🇯🇵 🇨🇳 🇰🇷 🇮🇳 🇦🇺'.split(
        ' '
      ),
  },
];

const isZipOrPdf = (file) => {
  const name = String(file?.name || '').toLowerCase();

  return ALLOWED_DOCUMENT_TYPES.has(file?.type) || name.endsWith('.pdf') || name.endsWith('.zip');
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
  disabled,
  recipients,
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

  const [message, setMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiCategory, setEmojiCategory] = useState(CHAT_EMOJI_CATEGORIES[0].label);
  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const currentEmojiCategory =
    CHAT_EMOJI_CATEGORIES.find((category) => category.label === emojiCategory) ||
    CHAT_EMOJI_CATEGORIES[0];

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
      pendingAttachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { messageData, conversationData } = initialConversation({
    message,
    recipients,
    me: currentContact,
    replyMessage,
  });

  const handleOpenImages = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleOpenFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChangeMessage = useCallback((event) => {
    setMessage(event.target.value);
  }, []);

  const handleInsertEmoji = useCallback((emoji) => {
    setMessage((currentMessage) => `${currentMessage}${emoji}`);
  }, []);

  const sendAttachmentMessages = useCallback(
    async ({ uploads, contentType }) => {
      let activeConversationId = selectedConversationId;

      for (const upload of uploads) {
        const attachmentMessage = buildAttachmentMessage({
          upload,
          contentType,
          senderId: currentContact.idMiembros || currentContact.id,
        });

        if (activeConversationId) {
          await sendMessage(activeConversationId, attachmentMessage, currentContact.idMiembros);
        } else {
          const nextConversationData = {
            ...conversationData,
            messages: [attachmentMessage],
          };
          const res = await createConversation(nextConversationData, currentContact.idMiembros);

          activeConversationId = res.conversation.id;
          router.push(`${paths.dashboard.chat}?id=${activeConversationId}`);
          onAddRecipients([]);
        }
      }
    },
    [
      conversationData,
      currentContact.id,
      currentContact.idMiembros,
      onAddRecipients,
      router,
      selectedConversationId,
    ]
  );

  const handleSubmitMessage = useCallback(async () => {
    if (!message && !pendingAttachments.length) return;

    const textToSend = message;
    const attachmentsToSend = pendingAttachments;

    setMessage('');
    setPendingAttachments([]);
    onClearReply?.();

    try {
      if (editingMessage && selectedConversationId) {
        onClearEditing?.();
        await editMessage(
          selectedConversationId,
          editingMessage.id,
          textToSend,
          currentContact.idMiembros
        );
        return;
      }

      if (attachmentsToSend.length) {
        const imageAttachments = attachmentsToSend.filter((item) => item.contentType === 'image');
        const fileAttachments = attachmentsToSend.filter((item) => item.contentType === 'file');

        if (imageAttachments.length && selectedConversationId) {
          const localImageMessage = {
            id: uuidv4(),
            attachments: imageAttachments.map((item) => ({
              id: item.id,
              nombre: item.file.name,
              nombreOriginal: item.file.name,
              tipo: item.file.type,
              tamano: item.file.size,
              previewUrl: item.previewUrl,
            })),
            body: imageAttachments[0].previewUrl,
            contentType: 'image',
            createdAt: new Date().toISOString(),
            senderId: String(currentContact.idMiembros || currentContact.id),
            estadoEnvio: 'enviando',
          };

          await addLocalMessage(selectedConversationId, localImageMessage);

          const uploads = await uploadFilesToStorage({
            files: imageAttachments.map((item) => item.file),
            storagePathBuilder: (file, index) =>
              `chat/${selectedConversationId}/imagenes/${buildStorageFileName(file, index)}`,
            metadataBuilder: () => ({
              modulo: 'chat',
              tipo: 'imagen',
              remitenteIdMiembros: String(currentContact.idMiembros || ''),
            }),
          });

          await sendMessage(
            selectedConversationId,
            {
              ...localImageMessage,
              attachments: uploads,
              body: uploads[0]?.url || uploads[0]?.downloadURL || localImageMessage.body,
            },
            currentContact.idMiembros
          );

          imageAttachments.forEach((item) => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          });
        }

        if (imageAttachments.length && !selectedConversationId) {
          const uploads = await uploadFilesToStorage({
            files: imageAttachments.map((item) => item.file),
            storagePathBuilder: (file, index) =>
              `chat/${currentContact.idMiembros || 'nuevo'}/imagenes/${buildStorageFileName(file, index)}`,
            metadataBuilder: () => ({
              modulo: 'chat',
              tipo: 'imagen',
              remitenteIdMiembros: String(currentContact.idMiembros || ''),
            }),
          });

          await sendAttachmentMessages({ uploads, contentType: 'image' });
        }

        if (fileAttachments.length) {
          const uploads = await uploadFilesToStorage({
            files: fileAttachments.map((item) => item.file),
            storagePathBuilder: (file, index) =>
              `chat/${selectedConversationId || currentContact.idMiembros || 'nuevo'}/archivos/${buildStorageFileName(file, index)}`,
            metadataBuilder: () => ({
              modulo: 'chat',
              tipo: 'archivo',
              remitenteIdMiembros: String(currentContact.idMiembros || ''),
            }),
          });

          await sendAttachmentMessages({ uploads, contentType: 'file' });
        }
      }

      if (!textToSend) return;

      if (selectedConversationId) {
        await sendMessage(
          selectedConversationId,
          { ...messageData, body: textToSend },
          currentContact.idMiembros
        );
      } else {
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
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo enviar el mensaje.');
      setPendingAttachments(attachmentsToSend);
      setMessage(textToSend);
    }
  }, [
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
    sendAttachmentMessages,
  ]);

  const handleSendMessage = useCallback(
    async (event) => {
      if (event.key !== 'Enter') return;

      await handleSubmitMessage();
    },
    [handleSubmitMessage]
  );

  const handleUploadImages = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    const imageFiles = files.filter((file) => String(file.type || '').startsWith('image/'));

    if (imageFiles.length !== files.length) {
      toast.error('Solo puedes enviar imagenes desde este boton.');
      return;
    }

    if (imageFiles.length > MAX_IMAGE_FILES) {
      toast.error('Puedes enviar un maximo de 10 imagenes a la vez.');
      return;
    }

    setPendingAttachments(
      imageFiles.map((file, index) => ({
        id: `image-${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        contentType: 'image',
        previewUrl: URL.createObjectURL(file),
      }))
    );
  }, []);

  const handleUploadFiles = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (!files.length) return;

    if (!files.every(isZipOrPdf)) {
      toast.error('Solo puedes enviar archivos PDF o ZIP.');
      return;
    }

    const totalSize = files.reduce((total, file) => total + Number(file.size || 0), 0);

    if (totalSize > MAX_DOCUMENT_TOTAL_SIZE) {
      toast.error('Los archivos PDF/ZIP no pueden superar 1 MB en conjunto.');
      return;
    }

    setPendingAttachments(
      files.map((file, index) => ({
        id: `file-${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        contentType: 'file',
      }))
    );
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
                  onClick={() => setPreviewImage(item)}
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
                    src={item.previewUrl}
                    alt={item.file.name}
                    sx={{ width: 1, height: 1, display: 'block', objectFit: 'cover' }}
                  />
                </Box>
              ) : (
                <Iconify icon="solar:file-bold" width={20} />
              )}

              <Typography noWrap variant="body2" sx={{ minWidth: 0, flexGrow: 1 }}>
                {item.file.name}
              </Typography>

              <IconButton
                size="small"
                onClick={() =>
                  setPendingAttachments((currentItems) => {
                    if (item.previewUrl) {
                      URL.revokeObjectURL(item.previewUrl);
                    }

                    return currentItems.filter((currentItem) => currentItem.id !== item.id);
                  })
                }
              >
                <Iconify icon="mingcute:close-line" width={16} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      <Popover
        open={Boolean(previewImage)}
        anchorEl={imageInputRef.current}
        onClose={() => setPreviewImage(null)}
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
        {previewImage && (
          <Box>
            <Box
              component="img"
              src={previewImage.previewUrl}
              alt={previewImage.file.name}
              sx={{
                width: 420,
                maxWidth: 'calc(100vw - 64px)',
                maxHeight: 420,
                display: 'block',
                borderRadius: 1,
                objectFit: 'contain',
              }}
            />
            <Typography noWrap variant="caption" sx={{ mt: 1, display: 'block' }}>
              {previewImage.file.name}
            </Typography>
          </Box>
        )}
      </Popover>

      <InputBase
        name="chat-message"
        id="chat-message-input"
        value={message}
        onKeyUp={handleSendMessage}
        onChange={handleChangeMessage}
        placeholder="Escribe un mensaje"
        disabled={disabled}
        startAdornment={
          <IconButton onClick={(event) => setEmojiAnchorEl(event.currentTarget)}>
            <Iconify icon="eva:smiling-face-fill" />
          </IconButton>
        }
        endAdornment={
          <Box sx={{ flexShrink: 0, display: 'flex' }}>
            <IconButton onClick={handleOpenImages}>
              <Iconify icon="solar:gallery-add-bold" />
            </IconButton>
            <IconButton onClick={handleOpenFiles}>
              <Iconify icon="eva:attach-2-fill" />
            </IconButton>
            <IconButton>
              <Iconify icon="solar:microphone-bold" />
            </IconButton>
            <IconButton
              color="primary"
              disabled={!message.trim() && !pendingAttachments.length}
              onClick={handleSubmitMessage}
            >
              <Iconify icon="solar:plain-bold" />
            </IconButton>
          </Box>
        }
        sx={[
          (theme) => ({
            px: 1,
            height: 56,
            flexShrink: 0,
            borderTop: `solid 1px ${theme.vars.palette.divider}`,
          }),
        ]}
      />

      <Popover
        open={emojiPickerOpen}
        anchorEl={emojiAnchorEl}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', borderRadius: 1.5 } },
        }}
      >
        <Box sx={{ p: 1 }}>
          <Box sx={{ gap: 0.5, mb: 1, display: 'flex', overflowX: 'auto' }}>
            {CHAT_EMOJI_CATEGORIES.map((category) => (
              <Box
                key={category.label}
                component="button"
                type="button"
                onClick={() => setEmojiCategory(category.label)}
                sx={{
                  px: 1,
                  py: 0.5,
                  border: 0,
                  borderRadius: 1,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  typography: 'caption',
                  color: emojiCategory === category.label ? 'primary.contrastText' : 'text.primary',
                  bgcolor: emojiCategory === category.label ? 'primary.main' : 'background.neutral',
                }}
              >
                {category.label}
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              gap: 0.25,
              display: 'grid',
              maxHeight: 260,
              overflowY: 'auto',
              gridTemplateColumns: 'repeat(8, 1fr)',
            }}
          >
            {currentEmojiCategory.emojis.map((emoji, index) => (
              <IconButton
                key={`${emoji}-${index}`}
                size="small"
                onClick={() => handleInsertEmoji(emoji)}
                sx={{ width: 38, height: 38, fontSize: 22 }}
              >
                {emoji}
              </IconButton>
            ))}
          </Box>
        </Box>
      </Popover>

      <input
        multiple
        type="file"
        accept="image/*"
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
