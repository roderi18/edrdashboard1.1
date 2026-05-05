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

import { sendMessage, editMessage, createConversation } from 'src/actions/chat';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { initialConversation } from './utils/initial-conversation';

// ----------------------------------------------------------------------

const MAX_IMAGE_FILES = 10;
const MAX_DOCUMENT_TOTAL_SIZE = 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf', 'application/zip', 'application/x-zip-compressed']);
const CHAT_EMOJI_CATEGORIES = [
  {
    label: 'Caras',
    emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🫣 🤗 🤔 🫡 🤭 🫢 🫠 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕'.split(
      ' '
    ),
  },
  {
    label: 'Gestos',
    emojis: '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🖐️ ✋ 🤚 👋 🤙 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 👌 👈 👉 👆 👇 ☝️ ✋ 🫵'.split(
      ' '
    ),
  },
  {
    label: 'Personas',
    emojis: '👶 🧒 👦 👧 🧑 👨 👩 🧔 👱 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 👷 💂 🕵️ 👩‍⚕️ 👨‍⚕️ 👩‍🏫 👨‍🏫 👩‍🍳 👨‍🍳 👩‍💻 👨‍💻 👩‍🎤 👨‍🎤 👩‍🚀 👨‍🚀 🧙 🧚 🧛 🧜 🧝 🧞 🧟'.split(
      ' '
    ),
  },
  {
    label: 'Corazones',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 💯 💢 💥 💫 💦 💨 🕳️'.split(
      ' '
    ),
  },
  {
    label: 'Animales',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🦟 🦗 🕷️ 🦂 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈'.split(
      ' '
    ),
  },
  {
    label: 'Comida',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂'.split(
      ' '
    ),
  },
  {
    label: 'Actividad',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🚵 🎮 🕹️ 🎲 ♟️ 🎯 🎳'.split(
      ' '
    ),
  },
  {
    label: 'Viajes',
    emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🏍️ 🛵 🚲 🛴 🛹 🛼 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🚁 🚀 🛸 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🛟 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️'.split(
      ' '
    ),
  },
  {
    label: 'Objetos',
    emojis: '⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🧱'.split(
      ' '
    ),
  },
  {
    label: 'Símbolos',
    emojis: '✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ❕ ❔ ❗ ❓ ‼️ ⁉️ 💬 💭 🗯️ ♠️ ♥️ ♦️ ♣️ 🃏 🀄 🎴 🔇 🔈 🔉 🔊 📢 📣 🔔 🔕 🎵 🎶 💹 🛐 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓'.split(
      ' '
    ),
  },
  {
    label: 'Banderas',
    emojis: '🇩🇴 🇺🇸 🇵🇷 🇪🇸 🇲🇽 🇨🇴 🇻🇪 🇨🇺 🇭🇹 🇵🇦 🇨🇷 🇭🇳 🇳🇮 🇸🇻 🇬🇹 🇧🇷 🇦🇷 🇨🇱 🇵🇪 🇪🇨 🇺🇾 🇵🇾 🇧🇴 🇨🇦 🇬🇧 🇫🇷 🇩🇪 🇮🇹 🇵🇹 🇯🇵 🇨🇳 🇰🇷 🇮🇳 🇦🇺'.split(
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
}) {
  const router = useRouter();

  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [message, setMessage] = useState('');
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

  const handleSendMessage = useCallback(
    async (event) => {
      if (event.key !== 'Enter' || !message) return;

      setMessage('');
      onClearReply?.();

      try {
        if (editingMessage && selectedConversationId) {
          onClearEditing?.();
          await editMessage(
            selectedConversationId,
            editingMessage.id,
            message,
            currentContact.idMiembros
          );
          return;
        }

        if (selectedConversationId) {
          await sendMessage(selectedConversationId, messageData, currentContact.idMiembros);
        } else {
          const res = await createConversation(conversationData, currentContact.idMiembros);
          router.push(`${paths.dashboard.chat}?id=${res.conversation.id}`);

          onAddRecipients([]);
        }
      } catch (error) {
        console.error(error);
      }
    },
    [
      conversationData,
      currentContact.idMiembros,
      message,
      messageData,
      onClearReply,
      onClearEditing,
      onAddRecipients,
      router,
      editingMessage,
      selectedConversationId,
    ]
  );

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

  const handleUploadImages = useCallback(
    async (event) => {
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

      try {
        const uploads = await uploadFilesToStorage({
          files: imageFiles,
          storagePathBuilder: (file, index) =>
            `chat/${selectedConversationId || currentContact.idMiembros || 'nuevo'}/imagenes/${buildStorageFileName(file, index)}`,
          metadataBuilder: () => ({
            modulo: 'chat',
            tipo: 'imagen',
            remitenteIdMiembros: String(currentContact.idMiembros || ''),
          }),
        });

        await sendAttachmentMessages({ uploads, contentType: 'image' });
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudieron enviar las imagenes.');
      }
    },
    [currentContact.idMiembros, selectedConversationId, sendAttachmentMessages]
  );

  const handleUploadFiles = useCallback(
    async (event) => {
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

      try {
        const uploads = await uploadFilesToStorage({
          files,
          storagePathBuilder: (file, index) =>
            `chat/${selectedConversationId || currentContact.idMiembros || 'nuevo'}/archivos/${buildStorageFileName(file, index)}`,
          metadataBuilder: () => ({
            modulo: 'chat',
            tipo: 'archivo',
            remitenteIdMiembros: String(currentContact.idMiembros || ''),
          }),
        });

        await sendAttachmentMessages({ uploads, contentType: 'file' });
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudieron enviar los archivos.');
      }
    },
    [currentContact.idMiembros, selectedConversationId, sendAttachmentMessages]
  );

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
        slotProps={{ paper: { sx: { width: 360, maxWidth: 'calc(100vw - 32px)', borderRadius: 1.5 } } }}
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
