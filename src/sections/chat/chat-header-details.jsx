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
  onClearGlobal,
  onUpdateGroup,
}) {
  const lgUp = useMediaQuery((theme) => theme.breakpoints.up('lg'));

  const menuActions = usePopover();
  const [reportOpen, setReportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [globalClearOpen, setGlobalClearOpen] = useState(false);
  const [groupEditOpen, setGroupEditOpen] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');
  const [reporting, setReporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const isGroup = conversation?.type === 'GROUP';
  const isMuted = Boolean(conversation?.muted);
  const canManageGroup = ['creator', 'admin'].includes(conversation?.currentUserGroupRole);
  const canClearGlobally = Boolean(conversation?.canClearGlobally);

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

  const handleOpenGlobalClear = useCallback(() => {
    menuActions.onClose();
    setGlobalClearOpen(true);
  }, [menuActions]);

  const handleOpenGroupEdit = useCallback(() => {
    menuActions.onClose();
    setGroupName(conversation?.groupName || '');
    setGroupAvatarUrl(conversation?.groupAvatarUrl || '');
    setGroupEditOpen(true);
  }, [conversation?.groupAvatarUrl, conversation?.groupName, menuActions]);

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
      toast.success('El historial se ocultó para ti.');
      setClearOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo vaciar el chat.');
    } finally {
      setClearing(false);
    }
  }, [onClear]);

  const handleSubmitGlobalClear = useCallback(async () => {
    setClearing(true);

    try {
      await onClearGlobal?.();
      toast.success('El historial se eliminó para todos los participantes.');
      setGlobalClearOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo eliminar el historial global.');
    } finally {
      setClearing(false);
    }
  }, [onClearGlobal]);

  const handleSubmitGroup = useCallback(async () => {
    setSavingGroup(true);

    try {
      await onUpdateGroup?.(groupName, groupAvatarUrl);
      toast.success('Información del grupo actualizada.');
      setGroupEditOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo actualizar el grupo.');
    } finally {
      setSavingGroup(false);
    }
  }, [groupAvatarUrl, groupName, onUpdateGroup]);

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

        {isGroup && canManageGroup && (
          <MenuItem onClick={handleOpenGroupEdit}>
            <Iconify icon="solar:pen-bold" />
            Editar grupo
          </MenuItem>
        )}

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuItem onClick={handleOpenClear} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" />
          Limpiar historial para mí
        </MenuItem>

        {canClearGlobally && onClearGlobal && (
          <MenuItem onClick={handleOpenGlobalClear} sx={{ color: 'error.main' }}>
            <Iconify icon="solar:trash-bin-minimalistic-bold" />
            Eliminar historial para todos
          </MenuItem>
        )}
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
        open={globalClearOpen}
        title="Eliminar historial para todos"
        onClose={() => setGlobalClearOpen(false)}
        content="Esta acción eliminará permanentemente todos los mensajes y adjuntos del grupo para todos sus participantes."
        action={
          <Button
            color="error"
            variant="contained"
            loading={clearing}
            onClick={handleSubmitGlobalClear}
          >
            Eliminar para todos
          </Button>
        }
      />

      <ConfirmDialog
        open={groupEditOpen}
        title="Editar grupo"
        onClose={() => setGroupEditOpen(false)}
        content={
          <Box sx={{ gap: 2, pt: 1, display: 'flex', flexDirection: 'column' }}>
            <TextField
              fullWidth
              label="Nombre del grupo"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              inputProps={{ maxLength: 80 }}
            />
            <TextField
              fullWidth
              label="URL HTTPS del avatar (opcional)"
              value={groupAvatarUrl}
              onChange={(event) => setGroupAvatarUrl(event.target.value)}
            />
          </Box>
        }
        action={
          <Button variant="contained" loading={savingGroup} onClick={handleSubmitGroup}>
            Guardar cambios
          </Button>
        }
      />

      <ConfirmDialog
        open={clearOpen}
        title="Limpiar historial para mí"
        onClose={() => setClearOpen(false)}
        content={`¿Seguro que deseas vaciar el chat con ${
          singleParticipant?.name || 'esta persona'
        }? Los demás participantes conservarán sus mensajes.`}
        action={
          <Button color="error" variant="contained" loading={clearing} onClick={handleSubmitClear}>
            Limpiar historial
          </Button>
        }
      />
    </>
  );
}
