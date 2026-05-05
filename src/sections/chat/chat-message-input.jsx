import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { sendMessage, editMessage, createConversation } from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';

import { initialConversation } from './utils/initial-conversation';

// ----------------------------------------------------------------------

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

  const fileRef = useRef(null);

  const [message, setMessage] = useState('');

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

  const handleAttach = useCallback(() => {
    if (fileRef.current) {
      fileRef.current.click();
    }
  }, []);

  const handleChangeMessage = useCallback((event) => {
    setMessage(event.target.value);
  }, []);

  const handleSendMessage = useCallback(
    async (event) => {
      if (event.key !== 'Enter' || !message) return;

      setMessage('');
      onClearReply?.();

      try {
        if (editingMessage && selectedConversationId) {
          await editMessage(
            selectedConversationId,
            editingMessage.id,
            message,
            currentContact.idMiembros
          );
          onClearEditing?.();
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
          <IconButton>
            <Iconify icon="eva:smiling-face-fill" />
          </IconButton>
        }
        endAdornment={
          <Box sx={{ flexShrink: 0, display: 'flex' }}>
            <IconButton onClick={handleAttach}>
              <Iconify icon="solar:gallery-add-bold" />
            </IconButton>
            <IconButton onClick={handleAttach}>
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

      <input type="file" ref={fileRef} style={{ display: 'none' }} />
    </>
  );
}
