import { useState } from 'react';

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
}) {
  const { me, senderDetails, hasImage } = getMessage({
    message,
    participants,
    currentUserId: currentContact.id,
  });

  const { firstName, avatarUrl } = senderDetails;

  const { body, createdAt } = message;
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const isSent = me && message.estadoEnvio !== 'enviando';
  const reactions = Object.values(message.reactions || {});
  const isDeleted = message.eliminado;
  const emojiPickerOpen = Boolean(emojiAnchorEl);

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
      ) : (
        <>
          {message.replyTo && (
            <Box
              sx={{
                mb: 1,
                px: 1,
                py: 0.75,
                borderRadius: 0.75,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                maxWidth: 1,
                overflow: 'hidden',
                borderLeft: (theme) => `3px solid ${theme.vars.palette.primary.main}`,
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

      {!!reactions.length && (
        <Box sx={{ mt: 0.75, display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
          <Box
            component="span"
            sx={{
              px: 0.75,
              py: 0.25,
              borderRadius: 10,
              typography: 'caption',
              bgcolor: 'background.paper',
              boxShadow: 1,
            }}
          >
            {reactions.join(' ')}
          </Box>
        </Box>
      )}
    </Stack>
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
                setEmojiAnchorEl(null);
                onReact?.(message, emoji);
              }}
              sx={{ fontSize: 20 }}
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
    <Box sx={{ mb: 5, display: 'flex', justifyContent: me ? 'flex-end' : 'unset' }}>
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
          {renderDeliveryStatus()}
          {renderActions()}
        </Box>
      </Stack>
    </Box>
  );
}
