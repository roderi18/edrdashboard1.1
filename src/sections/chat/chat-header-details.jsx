import { useState, useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import useMediaQuery from '@mui/material/useMediaQuery';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { fToNow } from 'src/utils/format-time';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { ChatHeaderSkeleton } from './chat-skeleton';
import { PRESENCE_LABELS } from './utils/presence-labels';
import { usePresenceStatus } from './hooks/use-presence-status';

// ----------------------------------------------------------------------

export function ChatHeaderDetails({
  collapseNav,
  conversation,
  participants,
  loading,
  onToggleMute,
  onReport,
  onClear,
}) {
  const lgUp = useMediaQuery((theme) => theme.breakpoints.up('lg'));

  const menuActions = usePopover();
  const [reportOpen, setReportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [reporting, setReporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const isGroup = participants.length > 1;
  const isMuted = Boolean(conversation?.muted);

  const singleParticipant = participants[0];

  const { collapseDesktop, onCollapseDesktop, onOpenMobile } = collapseNav;

  const handleToggleNav = useCallback(() => {
    if (lgUp) {
      onCollapseDesktop();
    } else {
      onOpenMobile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lgUp]);

  const handleToggleMute = useCallback(async () => {
    menuActions.onClose();
    await onToggleMute?.();
  }, [menuActions, onToggleMute]);

  const handleOpenReport = useCallback(() => {
    menuActions.onClose();
    setReportOpen(true);
  }, [menuActions]);

  const handleOpenClear = useCallback(() => {
    menuActions.onClose();
    setClearOpen(true);
  }, [menuActions]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportComment.trim()) {
      toast.error('Escribe un comentario para reportar el chat.');
      return;
    }

    setReporting(true);

    try {
      await onReport?.(reportComment.trim());
      toast.success('Reporte enviado al administrador.');
      setReportComment('');
      setReportOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo enviar el reporte.');
    } finally {
      setReporting(false);
    }
  }, [onReport, reportComment]);

  const handleSubmitClear = useCallback(async () => {
    setClearing(true);

    try {
      await onClear?.();
      toast.success('Chat vaciado.');
      setClearOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo vaciar el chat.');
    } finally {
      setClearing(false);
    }
  }, [onClear]);

  const groupDisplayName =
    conversation?.groupName || participants.map((participant) => participant.name).join(', ');

  const renderGroup = () => (
    <Box sx={{ gap: 2, display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <AvatarGroup
        max={3}
        sx={{
          [`& .${avatarGroupClasses.avatar}`]: {
            width: 32,
            height: 32,
          },
        }}
      >
        {participants.map((participant, index) => (
          <Avatar
            key={`${participant.id ?? participant.idMiembros ?? participant.name ?? 'participante'}-${index}`}
            alt={participant.name}
            src={participant.avatarUrl}
          />
        ))}
      </AvatarGroup>

      <ListItemText
        primary={groupDisplayName}
        secondary={`${participants.length} participantes`}
        slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
      />
    </Box>
  );

  const singleParticipantPresence = usePresenceStatus(
    singleParticipant?.idMiembros ?? singleParticipant?.id
  );

  const renderSingle = () => (
    <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
      <Badge
        variant={singleParticipantPresence.status}
        badgeContent=" "
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Avatar src={singleParticipant?.avatarUrl} alt={singleParticipant?.name} />
      </Badge>

      <ListItemText
        primary={singleParticipant?.name}
        secondary={
          singleParticipantPresence.status === 'offline'
            ? fToNow(singleParticipantPresence.lastActivity)
            : PRESENCE_LABELS[singleParticipantPresence.status]
        }
      />
    </Box>
  );

  if (loading) {
    return <ChatHeaderSkeleton />;
  }

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
    >
      <MenuList>
        <MenuItem onClick={handleToggleMute}>
          <Iconify icon={isMuted ? 'solar:bell-bold' : 'solar:bell-off-bold'} />
          {isMuted ? 'Activar notificaciones' : 'Silenciar notificaciones'}
        </MenuItem>

        <MenuItem onClick={handleOpenReport}>
          <Iconify icon="solar:danger-triangle-bold" />
          Reportar
        </MenuItem>

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuItem onClick={handleOpenClear} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" />
          Vaciar chat
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      {isGroup ? renderGroup() : renderSingle()}

      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton>
          <Iconify icon="solar:phone-bold" />
        </IconButton>

        <IconButton>
          <Iconify icon="solar:videocamera-record-bold" />
        </IconButton>

        <IconButton onClick={handleToggleNav}>
          <Iconify
            icon={!collapseDesktop ? 'custom:sidebar-unfold-fill' : 'custom:sidebar-fold-fill'}
          />
        </IconButton>

        <IconButton onClick={menuActions.onOpen}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Box>

      {renderMenuActions()}

      <ConfirmDialog
        open={reportOpen}
        title="Reportar chat"
        onClose={() => setReportOpen(false)}
        content={
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Comentarios"
              value={reportComment}
              onChange={(event) => setReportComment(event.target.value)}
              helperText="Este comentario se enviara al administrador."
            />
          </Box>
        }
        action={
          <Button variant="contained" loading={reporting} onClick={handleSubmitReport}>
            Enviar reporte
          </Button>
        }
      />

      <ConfirmDialog
        open={clearOpen}
        title="Vaciar chat"
        onClose={() => setClearOpen(false)}
        content={`¿Seguro que deseas vaciar el chat con ${
          singleParticipant?.name || 'esta persona'
        }? Esta accion eliminara todos los mensajes de la conversacion.`}
        action={
          <Button color="error" variant="contained" loading={clearing} onClick={handleSubmitClear}>
            Vaciar chat
          </Button>
        }
      />
    </>
  );
}
