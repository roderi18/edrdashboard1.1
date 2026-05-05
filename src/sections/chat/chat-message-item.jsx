import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { fToNow } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { UnderlineLink } from 'src/components/link/underline-link';

import { getMessage } from './utils/get-message';

// ----------------------------------------------------------------------

const ORDER_NUMBER_REGEX = /(ORD-\d+)/g;
const ORDER_NUMBER_EXACT_REGEX = /^ORD-\d+$/;
const EMOJI_OPTIONS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}'];

const formatChatTime = (input) => {
  const value = fToNow(input);

  if (!value || value === 'Invalid') {
    return value;
  }

  return value.toLowerCase().startsWith('hace ') ? value : `hace ${value}`;
};

const renderMessageTextWithOrderLinks = (text = '') =>
  String(text)
    .split(ORDER_NUMBER_REGEX)
    .map((part, index) => {
      if (!ORDER_NUMBER_EXACT_REGEX.test(part)) {
        return part;
      }

      return (
        <UnderlineLink
          key={`${part}-${index}`}
          href={`${paths.dashboard.order.root}?orderNumber=${encodeURIComponent(part)}`}
          sx={{ color: 'primary.main', fontWeight: 700 }}
        >
          {part}
        </UnderlineLink>
      );
    });

export function ChatMessageItem({
  message,
  participants,
  currentContact,
  onOpenLightbox,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onRestore,
  onJumpToMessage,
  highlighted = false,
}) {
  const { me, senderDetails, hasImage } = getMessage({
    message,
    participants,
    currentUserId: currentContact.id,
  });

  const { firstName, avatarUrl } = senderDetails;

  const { body, createdAt } = message;
  const attachment = message.attachments?.[0] || null;
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const isSent = me && message.estadoEnvio !== 'enviando';
  const reactions = Object.values(localReactions);
  const isDeleted = message.eliminado;
  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const reactionKey = String(currentContact.idMiembros || currentContact.id || 'usuario');

  useEffect(() => {
    setLocalReactions(message.reactions || {});
  }, [message.reactions]);

  const handleSelectEmoji = (emoji) => {
    setEmojiAnchorEl(null);
    setLocalReactions((currentReactions) => {
      const nextReactions = { ...currentReactions };

      if (nextReactions[reactionKey] === emoji) {
        delete nextReactions[reactionKey];
      } else {
        nextReactions[reactionKey] = emoji;
      }

      return nextReactions;
    });
    onReact?.(message, emoji);
  };

  const renderInfo = () => (
    <Typography
      noWrap
      variant="caption"
      sx={{ mb: 1, color: 'text.disabled', ...(!me && { mr: 'auto' }) }}
    >
      {!me && `${firstName}, `}

      {formatChatTime(createdAt)}
    </Typography>
  );

  const renderBody = () => (
    <Stack
      sx={{
        p: 1.5,
        minWidth: 48,
        maxWidth: 320,
        borderRadius: 1,
        typography: 'body2',
        bgcolor: 'background.neutral',
        ...(me && { color: 'grey.800', bgcolor: 'primary.lighter' }),
        ...(hasImage && { p: 0, bgcolor: 'transparent' }),
      }}
    >
      {hasImage ? (
        <Box
          component="img"
          alt="Adjunto"
          src={body}
          onClick={() => onOpenLightbox(body)}
          sx={{
            width: 400,
            height: 'auto',
            borderRadius: 1.5,
            cursor: 'pointer',
            objectFit: 'cover',
            aspectRatio: '16/11',
            '&:hover': { opacity: 0.9 },
          }}
        />
      ) : message.contentType === 'file' && attachment ? (
        <Box
          component="a"
          href={attachment.url || attachment.downloadURL}
          target="_blank"
          rel="noreferrer"
          sx={{
            gap: 1,
            minWidth: 220,
            display: 'flex',
            color: 'inherit',
            alignItems: 'center',
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          <Iconify icon="solar:file-bold" width={24} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap variant="body2" sx={{ fontWeight: 700 }}>
              {attachment.nombre || body}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {attachment.tipo || 'Archivo'}
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          {message.replyTo && (
            <Box
              component="button"
              type="button"
              onClick={() => onJumpToMessage?.(message.replyTo.id)}
              sx={{
                width: 1,
                mb: 1,
                px: 1,
                py: 0.75,
                border: 0,
                borderRadius: 0.75,
                textAlign: 'left',
                cursor: 'pointer',
                color: 'text.secondary',
                bgcolor: 'background.paper',
                maxWidth: 1,
                overflow: 'hidden',
                borderLeft: (theme) => `3px solid ${theme.vars.palette.primary.main}`,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {message.replyTo.body}
              </Typography>
            </Box>
          )}

          {isDeleted ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <Typography
                component="span"
                variant="body2"
                sx={{ color: 'text.disabled', fontStyle: 'italic' }}
              >
                Mensaje eliminado
              </Typography>

              {me && (
                <UnderlineLink
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onRestore?.(message);
                  }}
                  sx={{
                    typography: 'caption',
                    fontWeight: 700,
                    color: 'primary.main',
                  }}
                >
                  Deshacer
                </UnderlineLink>
              )}
            </Box>
          ) : (
            <Typography component="span" variant="body2">
              {renderMessageTextWithOrderLinks(body)}
            </Typography>
          )}
        </>
      )}

    </Stack>
  );

  const renderReactions = () =>
    !!reactions.length && (
      <Box
        component="span"
        sx={{
          px: 0.75,
          py: 0.25,
          bottom: -10,
          right: me ? 22 : -10,
          zIndex: 1,
          borderRadius: 10,
          position: 'absolute',
          typography: 'caption',
          bgcolor: 'background.paper',
          boxShadow: 1,
        }}
      >
        {reactions.join(' ')}
      </Box>
    );

  const renderActions = () => (
    <>
      <Box
        className="message-actions"
        sx={(theme) => ({
          pt: 0.5,
          left: 0,
          opacity: 0,
          top: '100%',
          display: 'flex',
          position: 'absolute',
          transition: theme.transitions.create(['opacity'], {
            duration: theme.transitions.duration.shorter,
          }),
          ...(emojiPickerOpen && { opacity: 1 }),
          ...(me && { right: 0, left: 'unset' }),
        })}
      >
        <IconButton size="small" disabled={isDeleted} onClick={() => onReply?.(message)}>
          <Iconify icon="solar:reply-bold" width={16} />
        </IconButton>

        <IconButton
          size="small"
          disabled={isDeleted}
          onClick={(event) => setEmojiAnchorEl(event.currentTarget)}
        >
          <Iconify icon="eva:smiling-face-fill" width={16} />
        </IconButton>

        {me && (
          <IconButton size="small" disabled={isDeleted} onClick={() => onEdit?.(message)}>
            <Iconify icon="solar:pen-bold" width={16} />
          </IconButton>
        )}

        <IconButton size="small" disabled={isDeleted} onClick={() => onDelete?.(message)}>
          <Iconify icon="solar:trash-bin-trash-bold" width={16} />
        </IconButton>
      </Box>

      <Popover
        open={emojiPickerOpen}
        anchorEl={emojiAnchorEl}
        onClose={() => setEmojiAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: me ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: me ? 'right' : 'left' }}
        slotProps={{ paper: { sx: { p: 0.75, borderRadius: 1.5 } } }}
      >
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          {EMOJI_OPTIONS.map((emoji) => (
            <IconButton
              key={emoji}
              size="small"
              onClick={() => {
                handleSelectEmoji(emoji);
              }}
              sx={{
                fontSize: 20,
                bgcolor: localReactions[reactionKey] === emoji ? 'action.selected' : 'transparent',
                boxShadow: (theme) =>
                  localReactions[reactionKey] === emoji
                    ? `0 0 0 1px ${theme.vars.palette.primary.main}`
                    : 'none',
                '&:hover': {
                  bgcolor:
                    localReactions[reactionKey] === emoji ? 'action.selected' : 'action.hover',
                },
              }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Popover>
    </>
  );

  const renderDeliveryStatus = () =>
    isSent && (
      <Iconify
        icon="eva:done-all-fill"
        width={16}
        aria-label="Mensaje enviado"
        sx={{
          ml: 0.75,
          alignSelf: 'flex-end',
          lineHeight: 1,
          color: '#00A76F',
        }}
      />
    );

  if (!message.body) {
    return null;
  }

  return (
    <Box
      id={`chat-message-${message.id}`}
      sx={{
        mb: 5,
        display: 'flex',
        justifyContent: me ? 'flex-end' : 'unset',
        borderRadius: 1.5,
        transition: (theme) =>
          theme.transitions.create(['background-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
        ...(highlighted && {
          bgcolor: 'action.hover',
          boxShadow: (theme) => `0 0 0 2px ${theme.vars.palette.primary.main}`,
        }),
      }}
    >
      {!me && <Avatar alt={firstName} src={avatarUrl} sx={{ width: 32, height: 32, mr: 2 }} />}

      <Stack alignItems={me ? 'flex-end' : 'flex-start'}>
        {renderInfo()}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            '&:hover': { '& .message-actions': { opacity: 1 } },
          }}
        >
          {renderBody()}
          {renderReactions()}
          {renderDeliveryStatus()}
          {renderActions()}
        </Box>
      </Stack>
    </Box>
  );
}
