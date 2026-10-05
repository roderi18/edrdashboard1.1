import { usePopover } from 'minimal-shared/hooks';
import { useCallback, startTransition } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import AvatarGroup from '@mui/material/AvatarGroup';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import ListItemButton from '@mui/material/ListItemButton';

import { useRouter } from 'src/routes/hooks';

import { fToNow } from 'src/utils/format-time';

import {
  clickConversation,
  precargarConversacion,
  markConversationUnread,
} from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { irAlChat } from './utils/ruta-del-chat';
import { getNavItem } from './utils/get-nav-item';

// ----------------------------------------------------------------------

export function ChatNavItem({
  selected,
  collapse,
  conversation,
  currentContact,
  bandeja = '',
  onCloseMobile,
  presenceStatuses = {},
}) {
  const router = useRouter();

  const mdUp = useMediaQuery((theme) => theme.breakpoints.up('md'));

  const { group, displayName, displayText, participants, lastActivity } = getNavItem({
    conversation,
    currentUserId: currentContact.id,
  });

  const singleParticipant = participants[0];

  const singleParticipantStatus =
    presenceStatuses[String(singleParticipant?.idMiembros ?? singleParticipant?.id)]?.status ??
    'offline';
  const hasOnlineInGroup = Object.values(presenceStatuses).some(
    (presence) => presence.status && presence.status !== 'offline'
  );

  const precargar = useCallback(() => {
    precargarConversacion(conversation.id, currentContact.idMiembros);
  }, [conversation.id, currentContact.idMiembros]);

  const handleClickConversation = useCallback(() => {
    if (!mdUp) {
      onCloseMobile();
    }

    startTransition(() => {
      irAlChat(router, { id: conversation.id, bandeja });
    });

    clickConversation(conversation.id, currentContact.idMiembros).catch((error) => {
      console.error(error);
    });
  }, [conversation.id, currentContact.idMiembros, bandeja, mdUp, onCloseMobile, router]);

  // MARCAR COMO LEÍDO / NO LEÍDO desde la lista, como en WhatsApp: tres puntos al
  // pasar por encima (siempre a la vista en el móvil) o clic derecho.
  const menu = usePopover();
  const sinLeer = Number(conversation.unreadCount) > 0;

  const handleAbrirMenu = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      menu.onOpen(event);
    },
    [menu]
  );

  const handleCambiarLeido = useCallback(() => {
    menu.onClose();

    if (sinLeer) {
      clickConversation(conversation.id, currentContact.idMiembros).catch((error) => {
        console.error('[chat] no se pudo marcar la conversación como leída', error);
      });
      return;
    }

    // Si es la conversación abierta, se cierra: abierta y a la vista se volvería a
    // marcar leída al momento y la marca no duraría nada.
    if (selected) {
      startTransition(() => {
        irAlChat(router, { bandeja });
      });
    }

    markConversationUnread(conversation.id, currentContact.idMiembros).catch((error) => {
      console.error('[chat] no se pudo marcar la conversación como no leída', error);
    });
  }, [bandeja, conversation.id, currentContact.idMiembros, menu, router, selected, sinLeer]);

  const renderGroup = () => (
    <Badge variant={hasOnlineInGroup ? 'online' : 'invisible'} badgeContent=" ">
      <AvatarGroup variant="compact" sx={{ width: 48, height: 48 }}>
        {participants.slice(0, 2).map((participant, index) => (
          <Avatar
            slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
            key={`${participant.id ?? participant.idMiembros ?? participant.name ?? 'participante'}-${index}`}
            alt={participant.name}
            src={participant.avatarUrl}
          />
        ))}
      </AvatarGroup>
    </Badge>
  );

  const renderSingle = () => (
    <Badge
      variant={singleParticipantStatus}
      badgeContent=" "
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Avatar
        slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
        alt={singleParticipant?.name}
        src={singleParticipant?.avatarUrl}
        sx={{ width: 48, height: 48 }}
      />
    </Badge>
  );

  return (
    <Box component="li" sx={{ display: 'flex' }}>
      <ListItemButton
        onClick={handleClickConversation}
        // Al pasar por encima (o al tocar, antes de soltar) se adelanta la
        // conversación: al abrirla, los mensajes ya están y salen al instante.
        onPointerEnter={precargar}
        onTouchStart={precargar}
        onFocus={precargar}
        onContextMenu={collapse ? undefined : handleAbrirMenu}
        sx={{
          py: 1.5,
          px: 2.5,
          gap: 2,
          ...(selected && { bgcolor: 'action.selected' }),
          '&:hover .chat-nav-item-menu, & .chat-nav-item-menu:focus-visible': { opacity: 1 },
        }}
      >
        <Badge
          color="error"
          overlap="circular"
          badgeContent={collapse ? conversation.unreadCount : 0}
        >
          {group ? renderGroup() : renderSingle()}
        </Badge>

        {!collapse && (
          <>
            <ListItemText
              primary={displayName}
              secondary={displayText}
              slotProps={{
                primary: { noWrap: true },
                secondary: {
                  noWrap: true,
                  sx: {
                    ...(conversation.unreadCount && {
                      color: 'text.primary',
                      fontWeight: 'fontWeightSemiBold',
                    }),
                  },
                },
              }}
            />

            <Box
              sx={{
                display: 'flex',
                alignSelf: 'stretch',
                alignItems: 'flex-end',
                flexDirection: 'column',
              }}
            >
              {lastActivity && (
                <Typography
                  noWrap
                  variant="body2"
                  component="span"
                  sx={{ mb: 1.5, fontSize: 12, color: 'text.disabled' }}
                >
                  {fToNow(lastActivity)}
                </Typography>
              )}

              {!!conversation.unreadCount && (
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'info.main',
                  }}
                />
              )}

              {conversation.muted && (
                <Iconify
                  icon="solar:bell-off-bold"
                  width={16}
                  sx={{ color: 'text.disabled' }}
                />
              )}
            </Box>

            <IconButton
              size="small"
              className="chat-nav-item-menu"
              aria-label="Opciones de la conversación"
              onClick={handleAbrirMenu}
              onMouseDown={(event) => event.stopPropagation()}
              sx={{
                position: 'absolute',
                right: 4,
                bottom: 6,
                bgcolor: 'background.paper',
                opacity: menu.open ? 1 : 0,
                transition: (theme) => theme.transitions.create('opacity'),
                '@media (hover: none)': { opacity: 1 },
              }}
            >
              <Iconify icon="eva:more-vertical-fill" width={18} />
            </IconButton>
          </>
        )}
      </ListItemButton>

      <CustomPopover open={menu.open} anchorEl={menu.anchorEl} onClose={menu.onClose}>
        <MenuList>
          <MenuItem onClick={handleCambiarLeido}>
            <Iconify icon={sinLeer ? 'eva:done-all-fill' : 'solar:letter-unread-bold'} />
            {sinLeer ? 'Marcar como leído' : 'Marcar como no leído'}
          </MenuItem>
        </MenuList>
      </CustomPopover>
    </Box>
  );
}
