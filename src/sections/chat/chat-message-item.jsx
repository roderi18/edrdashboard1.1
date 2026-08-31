import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { fToNow } from 'src/utils/format-time';
import { toggleChatReaction } from 'src/utils/chat-reaction-core.mjs';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { UnderlineLink } from 'src/components/link/underline-link';

import { getMessage } from './utils/get-message';
import { CHAT_EMOJI_CATEGORIES } from './chat-message-input';
import { buildReactionGroups } from './utils/reaction-groups.mjs';

// ----------------------------------------------------------------------

const ORDER_NUMBER_REGEX = /(ORD-\d+)/g;
const ORDER_NUMBER_EXACT_REGEX = /^ORD-\d+$/;
const MISSING_FILE_INSTRUCTION = 'Presiona este número de orden para cargar el archivo faltante.';
const MESSAGE_DELETE_WINDOW_MS = 60 * 60 * 1000;
const EMOJI_OPTIONS = [
  '\u{1F44D}',
  '\u{2764}\u{FE0F}',
  '\u{1F602}',
  '\u{1F62E}',
  '\u{1F622}',
  '\u{1F64F}',
];
const REACTION_EMOJI_CATEGORIES = [
  {
    label: 'Caras',
    emojis: [
      '\u{1F600}',
      '\u{1F603}',
      '\u{1F604}',
      '\u{1F601}',
      '\u{1F606}',
      '\u{1F605}',
      '\u{1F602}',
      '\u{1F923}',
      '\u{1F60A}',
      '\u{1F607}',
      '\u{1F642}',
      '\u{1F643}',
      '\u{1F609}',
      '\u{1F60C}',
      '\u{1F60D}',
      '\u{1F970}',
      '\u{1F618}',
      '\u{1F617}',
      '\u{1F619}',
      '\u{1F61A}',
      '\u{1F60B}',
      '\u{1F61B}',
      '\u{1F61D}',
      '\u{1F61C}',
      '\u{1F92A}',
      '\u{1F928}',
      '\u{1F9D0}',
      '\u{1F913}',
      '\u{1F60E}',
      '\u{1F929}',
      '\u{1F973}',
      '\u{1F60F}',
      '\u{1F612}',
      '\u{1F61E}',
      '\u{1F614}',
      '\u{1F61F}',
      '\u{1F615}',
      '\u{1F641}',
      '\u{2639}\u{FE0F}',
      '\u{1F623}',
      '\u{1F616}',
      '\u{1F62B}',
      '\u{1F629}',
      '\u{1F97A}',
      '\u{1F622}',
      '\u{1F62D}',
      '\u{1F624}',
      '\u{1F620}',
      '\u{1F621}',
      '\u{1F92C}',
      '\u{1F92F}',
      '\u{1F633}',
      '\u{1F975}',
      '\u{1F976}',
      '\u{1F631}',
      '\u{1F628}',
      '\u{1F630}',
      '\u{1F625}',
      '\u{1F613}',
      '\u{1F917}',
      '\u{1F914}',
      '\u{1F92D}',
      '\u{1F925}',
      '\u{1F636}',
      '\u{1F610}',
      '\u{1F611}',
      '\u{1F62C}',
      '\u{1F644}',
      '\u{1F62F}',
      '\u{1F626}',
      '\u{1F627}',
      '\u{1F62E}',
      '\u{1F632}',
      '\u{1F971}',
      '\u{1F634}',
      '\u{1F924}',
      '\u{1F62A}',
      '\u{1F635}',
      '\u{1F910}',
      '\u{1F974}',
      '\u{1F922}',
      '\u{1F92E}',
      '\u{1F927}',
      '\u{1F637}',
      '\u{1F912}',
      '\u{1F915}',
    ],
  },
  {
    label: 'Gestos',
    emojis: [
      '\u{1F44D}',
      '\u{1F44E}',
      '\u{1F44A}',
      '\u{270A}',
      '\u{1F91B}',
      '\u{1F91C}',
      '\u{1F44F}',
      '\u{1F64C}',
      '\u{1F450}',
      '\u{1F932}',
      '\u{1F91D}',
      '\u{1F64F}',
      '\u{270D}\u{FE0F}',
      '\u{1F4AA}',
      '\u{1F590}\u{FE0F}',
      '\u{270B}',
      '\u{1F91A}',
      '\u{1F44B}',
      '\u{1F919}',
      '\u{1F90C}',
      '\u{1F90F}',
      '\u{270C}\u{FE0F}',
      '\u{1F91E}',
      '\u{1FAF0}',
      '\u{1F91F}',
      '\u{1F918}',
      '\u{1F44C}',
      '\u{1F448}',
      '\u{1F449}',
      '\u{1F446}',
      '\u{1F447}',
      '\u{261D}\u{FE0F}',
      '\u{1FAF5}',
    ],
  },
  {
    label: 'Corazones',
    emojis: [
      '\u{2764}\u{FE0F}',
      '\u{1F9E1}',
      '\u{1F49B}',
      '\u{1F49A}',
      '\u{1F499}',
      '\u{1F49C}',
      '\u{1F5A4}',
      '\u{1F90D}',
      '\u{1F90E}',
      '\u{1F494}',
      '\u{2764}\u{FE0F}\u{200D}\u{1F525}',
      '\u{2764}\u{FE0F}\u{200D}\u{1FA79}',
      '\u{2763}\u{FE0F}',
      '\u{1F495}',
      '\u{1F49E}',
      '\u{1F493}',
      '\u{1F497}',
      '\u{1F496}',
      '\u{1F498}',
      '\u{1F49D}',
      '\u{1F49F}',
      '\u{1F48C}',
      '\u{1F48B}',
      '\u{1F4AF}',
      '\u{1F4A2}',
      '\u{1F4A5}',
      '\u{1F4AB}',
      '\u{1F4A6}',
    ],
  },
  {
    label: 'Objetos',
    emojis: [
      '\u{1F389}',
      '\u{1F38A}',
      '\u{1F381}',
      '\u{1F3C6}',
      '\u{1F947}',
      '\u{1F948}',
      '\u{1F949}',
      '\u{2B50}',
      '\u{1F31F}',
      '\u{2728}',
      '\u{26A1}',
      '\u{1F525}',
      '\u{1F4A1}',
      '\u{1F4CC}',
      '\u{1F4CD}',
      '\u{1F4CE}',
      '\u{1F4DD}',
      '\u{1F4E2}',
      '\u{1F4E3}',
      '\u{1F514}',
      '\u{1F515}',
      '\u{1F4AC}',
      '\u{1F4AD}',
      '\u{1F4E9}',
      '\u{2705}',
      '\u{274C}',
      '\u{2757}',
      '\u{2753}',
      '\u{1F6AB}',
      '\u{1F6A8}',
      '\u{1F4B0}',
      '\u{1F4B3}',
    ],
  },
  {
    label: 'Naturaleza',
    emojis: [
      '\u{1F31E}',
      '\u{1F31D}',
      '\u{1F31A}',
      '\u{1F319}',
      '\u{2600}\u{FE0F}',
      '\u{1F324}\u{FE0F}',
      '\u{26C5}',
      '\u{2601}\u{FE0F}',
      '\u{1F327}\u{FE0F}',
      '\u{26C8}\u{FE0F}',
      '\u{1F308}',
      '\u{2744}\u{FE0F}',
      '\u{2603}\u{FE0F}',
      '\u{1F32A}\u{FE0F}',
      '\u{1F30A}',
      '\u{1F331}',
      '\u{1F33F}',
      '\u{2618}\u{FE0F}',
      '\u{1F340}',
      '\u{1F33A}',
      '\u{1F33B}',
      '\u{1F339}',
      '\u{1F490}',
      '\u{1F384}',
    ],
  },
];
const COMPLETE_REACTION_EMOJI_CATEGORIES = [
  ...REACTION_EMOJI_CATEGORIES,
  ...CHAT_EMOJI_CATEGORIES.filter(
    (category) =>
      !REACTION_EMOJI_CATEGORIES.some(
        (reactionCategory) => reactionCategory.label === category.label
      )
  ),
];

const formatChatTime = (input) => {
  const value = fToNow(input);

  if (!value || value === 'Invalid') {
    return value;
  }

  return value.toLowerCase().startsWith('hace ') ? value : `hace ${value}`;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightMentions = (text, participants = []) => {
  const names = participants.map((participant) => participant.name).filter(Boolean);

  if (!names.length || !String(text).includes('@')) {
    return text;
  }

  const mentionRegex = new RegExp(`(@(?:${names.map(escapeRegExp).join('|')}))`, 'g');

  return String(text)
    .split(mentionRegex)
    .map((part, index) =>
      names.some((name) => part === `@${name}`) ? (
        <Box
          key={`mention-${part}-${index}`}
          component="span"
          sx={{ color: 'primary.main', fontWeight: 700 }}
        >
          {part}
        </Box>
      ) : (
        part
      )
    );
};

const renderMessageTextWithOrderLinks = (text = '', metadata = {}, participants = []) =>
  String(text)
    .split(ORDER_NUMBER_REGEX)
    .map((part, index) => {
      if (!ORDER_NUMBER_EXACT_REGEX.test(part)) {
        return highlightMentions(part, participants);
      }

      const orderHref = metadata?.ordenId
        ? `/dashboard/order/${encodeURIComponent(metadata.ordenId)}`
        : `${paths.dashboard.order.root}?orderNumber=${encodeURIComponent(part)}`;

      return (
        <UnderlineLink
          key={`${part}-${index}`}
          href={orderHref}
          sx={{ color: 'primary.main', fontWeight: 700 }}
        >
          {part}
        </UnderlineLink>
      );
    });

const renderSharedFileLink = (text = '', metadata = {}, participants = []) => {
  const sharedFile = metadata?.sharedFile;
  const label = String(sharedFile?.name || '').trim();
  const href = sharedFile?.url;

  if (!label || !href || String(text).trim() !== label) {
    return null;
  }

  return (
    <>
      <UnderlineLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: 'primary.main', fontWeight: 700 }}
      >
        {label}
      </UnderlineLink>

      {!!sharedFile.message && (
        <Box component="span" sx={{ display: 'block', mt: 0.75 }}>
          {renderMessageTextWithOrderLinks(sharedFile.message, metadata, participants)}
        </Box>
      )}
    </>
  );
};

const renderMessageBodyText = (text = '', metadata = {}, participants = []) => {
  const sharedFileLink = renderSharedFileLink(text, metadata, participants);

  if (sharedFileLink) {
    return sharedFileLink;
  }

  return String(text)
    .split(MISSING_FILE_INSTRUCTION)
    .map((part, index, parts) => (
      <Box component="span" key={`message-part-${index}`} sx={{ display: 'contents' }}>
        {renderMessageTextWithOrderLinks(part, metadata, participants)}
        {index < parts.length - 1 && (
          <Typography
            component="span"
            variant="body2"
            sx={{
              display: 'block',
              mt: 1,
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          >
            {MISSING_FILE_INSTRUCTION}
          </Typography>
        )}
      </Box>
    ));
};

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
    currentUserId: [currentContact.idMiembros, currentContact.id],
  });

  const { firstName, avatarUrl } = senderDetails;

  const { body, createdAt } = message;
  const attachment = message.attachments?.[0] || null;
  const imageAttachments = (message.attachments || [])
    .map((item) => item.url || item.downloadURL || item.previewUrl)
    .filter(Boolean);
  const imageUrls = hasImage
    ? imageAttachments.length
      ? imageAttachments
      : [body].filter(Boolean)
    : [];
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [showAllReactionEmojis, setShowAllReactionEmojis] = useState(false);
  const [reactionEmojiCategory, setReactionEmojiCategory] = useState(
    COMPLETE_REACTION_EMOJI_CATEGORIES[0].label
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const isSent = me && message.estadoEnvio !== 'enviando';
  const deliveryStatus = message.deliveryStatus ?? message.estadoEntrega ?? 'enviado';
  const reactionGroups = buildReactionGroups({
    reactions: localReactions,
    participants,
    currentContact,
  });
  const isDeleted = message.eliminado;
  const sentAtTime = new Date(createdAt).getTime();
  const canDeleteMessage =
    Number.isFinite(sentAtTime) && currentTime - sentAtTime <= MESSAGE_DELETE_WINDOW_MS;
  const emojiPickerOpen = Boolean(emojiAnchorEl);
  const reactionKey = String(currentContact.idMiembros || currentContact.id || 'usuario');
  const selectedReactionEmoji = localReactions[reactionKey];
  const currentReactionEmojiCategory =
    COMPLETE_REACTION_EMOJI_CATEGORIES.find(
      (category) => category.label === reactionEmojiCategory
    ) || COMPLETE_REACTION_EMOJI_CATEGORIES[0];

  useEffect(() => {
    setLocalReactions(message.reactions || {});
  }, [message.reactions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearTimeout(timeout);
  }, [currentTime]);

  // REACCIONAR NO ESPERA A NADIE.
  //
  // La reaccion ya se pintaba al momento, pero los botones se quedaban
  // bloqueados hasta que el servidor contestaba: se pulsaba un emoji y no se
  // podia pulsar otro, ni cambiar de idea, hasta que volviera la respuesta. Eso
  // es lo que se sentia lento, no el dibujo.
  //
  // Ahora se pinta y se sigue. Si el guardado falla, se deshace ESA reaccion
  // —la de antes de este toque, no la que haya quedado despues— y se dice.
  const handleSelectEmoji = (emoji) => {
    const previousReactions = localReactions;
    const nextReactions = toggleChatReaction(previousReactions, reactionKey, emoji);

    setEmojiAnchorEl(null);
    setShowAllReactionEmojis(false);
    setLocalReactions(nextReactions);

    Promise.resolve(onReact?.(message, emoji)).catch((error) => {
      setLocalReactions(previousReactions);
      toast.error(error?.message || 'No se pudo guardar la reacción.');
    });
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
      ) : hasImage ? (
        <Box
          sx={{
            gap: 0.5,
            width: imageUrls.length > 1 ? 260 : 220,
            maxWidth: imageUrls.length > 1 ? 'min(70vw, 260px)' : 'min(64vw, 220px)',
            display: 'grid',
            gridTemplateColumns: imageUrls.length > 1 ? 'repeat(2, 1fr)' : '1fr',
          }}
        >
          {imageUrls.map((imageUrl, index) => (
            <Box
              key={`${imageUrl}-${index}`}
              component="img"
              loading="lazy"
              decoding="async"
              alt="Adjunto"
              src={imageUrl}
              onClick={() => onOpenLightbox(imageUrl)}
              sx={{
                width: 1,
                height: imageUrls.length > 1 ? 112 : 165,
                display: 'block',
                borderRadius: 1.5,
                cursor: 'pointer',
                objectFit: 'cover',
                '&:hover': { opacity: 0.9 },
              }}
            />
          ))}
        </Box>
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

          <Typography component="span" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {renderMessageBodyText(body, message.metadata, participants)}
          </Typography>
        </>
      )}
    </Stack>
  );

  const renderReactions = () =>
    !isDeleted &&
    !!reactionGroups.length && (
      <Box
        component="span"
        sx={{
          gap: 0.5,
          bottom: -14,
          right: me ? 22 : -10,
          zIndex: 1,
          display: 'flex',
          position: 'absolute',
        }}
      >
        {reactionGroups.map((group) => (
          <Tooltip
            arrow
            key={group.emoji}
            placement="top"
            enterTouchDelay={0}
            title={
              <Box sx={{ py: 0.25 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                  {`${group.emoji} ${group.count} ${group.count === 1 ? 'reacción' : 'reacciones'}`}
                </Typography>
                {group.names.map((name, index) => (
                  <Typography
                    key={`${group.memberIds[index]}-${name}`}
                    variant="caption"
                    sx={{ display: 'block' }}
                  >
                    {name}
                  </Typography>
                ))}
              </Box>
            }
          >
            <Box
              component="button"
              type="button"
              aria-label={`${group.emoji}: ${group.names.join(', ')}`}
              aria-pressed={selectedReactionEmoji === group.emoji}
              onClick={() => handleSelectEmoji(group.emoji)}
              sx={{
                gap: 0.4,
                px: 0.9,
                py: 0.35,
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 10,
                fontSize: 18,
                lineHeight: 1,
                cursor: 'pointer',
                border: (theme) =>
                  `1px solid ${
                    selectedReactionEmoji === group.emoji
                      ? theme.vars.palette.primary.main
                      : theme.vars.palette.divider
                  }`,
                bgcolor:
                  selectedReactionEmoji === group.emoji ? 'action.selected' : 'background.paper',
                boxShadow: 1,
                '&:focus-visible': {
                  outline: (theme) => `2px solid ${theme.vars.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              <Box component="span">{group.emoji}</Box>
              {group.count > 1 && (
                <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
                  {group.count}
                </Typography>
              )}
            </Box>
          </Tooltip>
        ))}
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
        <IconButton
          size="small"
          disabled={isDeleted}
          aria-label="Responder mensaje"
          onClick={() => onReply?.(message)}
        >
          <Iconify icon="solar:reply-bold" width={16} />
        </IconButton>

        <IconButton
          size="small"
          disabled={isDeleted}
          aria-label="Agregar reacción"
          onClick={(event) => {
            setShowAllReactionEmojis(false);
            setEmojiAnchorEl(event.currentTarget);
          }}
        >
          <Iconify icon="eva:smiling-face-fill" width={16} />
        </IconButton>

        {me && (
          <IconButton
            size="small"
            disabled={isDeleted}
            aria-label="Editar mensaje"
            onClick={() => onEdit?.(message)}
          >
            <Iconify icon="solar:pen-bold" width={16} />
          </IconButton>
        )}

        {me && canDeleteMessage && (
          <IconButton
            size="small"
            disabled={isDeleted}
            aria-label="Eliminar mensaje"
            onClick={() => onDelete?.(message)}
          >
            <Iconify icon="solar:trash-bin-trash-bold" width={16} />
          </IconButton>
        )}
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
          {EMOJI_OPTIONS.map((emoji, index) => (
            <IconButton
              key={`${emoji}-${index}`}
              size="small"
              aria-label={`Reaccionar con ${emoji}`}
              aria-pressed={selectedReactionEmoji === emoji}
              onClick={() => {
                handleSelectEmoji(emoji);
              }}
              sx={{
                fontSize: 24,
                bgcolor: selectedReactionEmoji === emoji ? 'action.selected' : 'transparent',
                boxShadow: (theme) =>
                  selectedReactionEmoji === emoji
                    ? `0 0 0 1px ${theme.vars.palette.primary.main}`
                    : 'none',
                '&:hover': {
                  bgcolor: selectedReactionEmoji === emoji ? 'action.selected' : 'action.hover',
                },
              }}
            >
              {emoji}
            </IconButton>
          ))}

          <IconButton
            size="small"
            aria-label={showAllReactionEmojis ? 'Ocultar más emojis' : 'Mostrar más emojis'}
            aria-expanded={showAllReactionEmojis}
            onClick={() => setShowAllReactionEmojis((value) => !value)}
            sx={{
              width: 36,
              height: 36,
              border: (theme) => `1px dashed ${theme.vars.palette.divider}`,
            }}
          >
            <Iconify icon="mingcute:add-line" width={18} />
          </IconButton>
        </Box>

        {showAllReactionEmojis && (
          <Box sx={{ width: 340, maxWidth: 'calc(100vw - 40px)', pt: 1 }}>
            <Box sx={{ gap: 0.5, mb: 1, display: 'flex', overflowX: 'auto' }}>
              {COMPLETE_REACTION_EMOJI_CATEGORIES.map((category) => (
                <Box
                  key={category.label}
                  component="button"
                  type="button"
                  aria-pressed={reactionEmojiCategory === category.label}
                  onClick={() => setReactionEmojiCategory(category.label)}
                  sx={{
                    px: 1,
                    py: 0.5,
                    border: 0,
                    borderRadius: 1,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    typography: 'caption',
                    color:
                      reactionEmojiCategory === category.label
                        ? 'primary.contrastText'
                        : 'text.primary',
                    bgcolor:
                      reactionEmojiCategory === category.label
                        ? 'primary.main'
                        : 'background.neutral',
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
                maxHeight: 220,
                overflowY: 'auto',
                gridTemplateColumns: 'repeat(8, 1fr)',
              }}
            >
              {currentReactionEmojiCategory.emojis.map((emoji, index) => (
                <IconButton
                  key={`${emoji}-${index}`}
                  size="small"
                      aria-label={`Reaccionar con ${emoji}`}
                  aria-pressed={selectedReactionEmoji === emoji}
                  onClick={() => handleSelectEmoji(emoji)}
                  sx={{
                    width: 42,
                    height: 42,
                    fontSize: 26,
                    bgcolor: selectedReactionEmoji === emoji ? 'action.selected' : 'transparent',
                    boxShadow: (theme) =>
                      selectedReactionEmoji === emoji
                        ? `0 0 0 1px ${theme.vars.palette.primary.main}`
                        : 'none',
                  }}
                >
                  {emoji}
                </IconButton>
              ))}
            </Box>
          </Box>
        )}
      </Popover>
    </>
  );

  const renderDeliveryStatus = () =>
    isSent && (
      <Iconify
        icon={deliveryStatus === 'enviado' ? 'eva:done-fill' : 'eva:done-all-fill'}
        width={16}
        aria-label={
          deliveryStatus === 'visto'
            ? 'Mensaje leído'
            : deliveryStatus === 'entregado'
              ? 'Mensaje entregado'
              : 'Mensaje enviado'
        }
        sx={{
          ml: 0.75,
          alignSelf: 'flex-end',
          lineHeight: 1,
          color: deliveryStatus === 'visto' ? '#00A76F' : 'text.disabled',
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
      {!me && <Avatar alt={firstName} src={avatarUrl} sx={{ width: 32, height: 32, mr: 2 }} slotProps={{ img: { loading: 'lazy', decoding: 'async' } }} />}

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
