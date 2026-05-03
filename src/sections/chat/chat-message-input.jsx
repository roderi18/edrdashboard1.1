import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { sendMessage, createConversation } from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';

import { initialConversation } from './utils/initial-conversation';

// ----------------------------------------------------------------------

export function ChatMessageInput({
  disabled,
  recipients,
  currentContact,
  onAddRecipients,
  selectedConversationId,
}) {
  const router = useRouter();

  const fileRef = useRef(null);

  const [message, setMessage] = useState('');

  const { messageData, conversationData } = initialConversation({
    message,
    recipients,
    me: currentContact,
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

      try {
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
      onAddRecipients,
      router,
      selectedConversationId,
    ]
  );

  return (
    <>
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
