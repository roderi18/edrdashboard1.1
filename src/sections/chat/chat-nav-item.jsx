import { useCallback, startTransition } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import AvatarGroup from '@mui/material/AvatarGroup';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import ListItemButton from '@mui/material/ListItemButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fToNow } from 'src/utils/format-time';

import { clickConversation } from 'src/actions/chat';

import { Iconify } from 'src/components/iconify';

import { getNavItem } from './utils/get-nav-item';

// ----------------------------------------------------------------------

export function ChatNavItem({
  selected,
  collapse,
  conversation,
  currentContact,
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

  const handleClickConversation = useCallback(() => {
    if (!mdUp) {
      onCloseMobile();
    }

    const redirectPath = `${paths.dashboard.chat}?id=${conversation.id}`;

    startTransition(() => {
      router.push(redirectPath);
    });

    clickConversation(conversation.id, currentContact.idMiembros).catch((error) => {
      console.error(error);
    });
  }, [conversation.id, currentContact.idMiembros, mdUp, onCloseMobile, router]);

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
        sx={{
          py: 1.5,
          px: 2.5,
          gap: 2,
          ...(selected && { bgcolor: 'action.selected' }),
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
          </>
        )}
      </ListItemButton>
    </Box>
  );
}
