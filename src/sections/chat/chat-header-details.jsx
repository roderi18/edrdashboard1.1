import { flushSync } from 'react-dom';
import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
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
import { resolveGroupNameEdit } from './utils/group-name-edit.mjs';

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
  const cancelGroupEditRef = useRef(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [globalClearOpen, setGlobalClearOpen] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [groupName, setGroupName] = useState('');
  const [optimisticGroupName, setOptimisticGroupName] = useState('');
  const [reporting, setReporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const isGroup = conversation?.type === 'GROUP';
  const isMuted = Boolean(conversation?.muted);
  const canManageGroup = ['creator', 'admin'].includes(conversation?.currentUserGroupRole);
  const canClearGlobally = Boolean(conversation?.canClearGlobally);
  const persistedGroupDisplayName =
    conversation?.groupName || participants.map((participant) => participant.name).join(', ');
  const groupDisplayName = optimisticGroupName || persistedGroupDisplayName;

  const singleParticipant = participants[0];

  const { collapseDesktop, onCollapseDesktop, onOpenMobile } = collapseNav;

  useEffect(() => {
    setEditingGroupName(false);
    setGroupName('');
    setOptimisticGroupName('');
  }, [conversation?.id]);

  useEffect(() => {
    if (
      optimisticGroupName &&
      String(conversation?.groupName || '').trim() === optimisticGroupName
    ) {
      setOptimisticGroupName('');
    }
  }, [conversation?.groupName, optimisticGroupName]);

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
    cancelGroupEditRef.current = false;
    setGroupName(groupDisplayName);
    setEditingGroupName(true);
  }, [groupDisplayName, menuActions]);

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
    const edit = resolveGroupNameEdit(persistedGroupDisplayName, groupName);

    // Un campo vacío o intacto equivale a cancelar: el grupo conserva exactamente
    // el nombre que ya mostraba.
    if (!edit.shouldSave) {
      setEditingGroupName(false);
      setGroupName('');
      return;
    }

    const previousName = persistedGroupDisplayName;

    // Confirma el nombre en pantalla antes de iniciar cualquier trabajo remoto.
    // flushSync evita que React agrupe este render con la respuesta de la API.
    flushSync(() => {
      setOptimisticGroupName(edit.name);
      setEditingGroupName(false);
      setGroupName('');
      setSavingGroup(true);
    });

    try {
      await onUpdateGroup?.(edit.name, conversation?.groupAvatarUrl || '');
      toast.success('Nombre del grupo actualizado.');
    } catch (error) {
      console.error(error);
      setOptimisticGroupName('');
      setGroupName(previousName);
      toast.error(error.message || 'No se pudo cambiar el nombre del grupo.');
    } finally {
      setSavingGroup(false);
    }
  }, [conversation?.groupAvatarUrl, groupName, onUpdateGroup, persistedGroupDisplayName]);

  const handleGroupNameBlur = useCallback(() => {
    if (cancelGroupEditRef.current) {
      cancelGroupEditRef.current = false;
      return;
    }

    void handleSubmitGroup();
  }, [handleSubmitGroup]);

  const handleGroupNameKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        cancelGroupEditRef.current = true;
        void handleSubmitGroup();
        queueMicrotask(() => {
          cancelGroupEditRef.current = false;
        });
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelGroupEditRef.current = true;
        setEditingGroupName(false);
        setGroupName('');
      }
    },
    [handleSubmitGroup]
  );

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

      <Box sx={{ minWidth: 0, flex: '1 1 auto' }}>
        {editingGroupName ? (
          <TextField
            autoFocus
            fullWidth
            hiddenLabel
            size="small"
            variant="standard"
            value={groupName}
            disabled={savingGroup}
            inputProps={{ maxLength: 80, 'aria-label': 'Nombre del grupo' }}
            onChange={(event) => setGroupName(event.target.value)}
            onKeyDown={handleGroupNameKeyDown}
            onBlur={handleGroupNameBlur}
            sx={{ maxWidth: 520 }}
          />
        ) : (
          <Typography
            noWrap
            variant="subtitle2"
            component={canManageGroup ? 'button' : 'div'}
            type={canManageGroup ? 'button' : undefined}
            onClick={canManageGroup ? handleOpenGroupEdit : undefined}
            sx={{
              p: 0,
              m: 0,
              width: 1,
              border: 0,
              color: 'text.primary',
              textAlign: 'left',
              bgcolor: 'transparent',
              cursor: canManageGroup ? 'text' : 'default',
            }}
          >
            {groupDisplayName}
          </Typography>
        )}

        <Typography noWrap variant="body2" color="text.secondary">
          {participants.length} participantes
        </Typography>
      </Box>

      {canManageGroup && !editingGroupName && (
        <Tooltip title="Cambiar nombre del chat">
          <IconButton
            size="small"
            aria-label="Cambiar nombre del chat"
            onClick={handleOpenGroupEdit}
            sx={{ flexShrink: 0 }}
          >
            <Iconify icon="solar:pen-bold" width={18} />
          </IconButton>
        </Tooltip>
      )}
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

        {/* En un chat que todavia no existe no hay nada que silenciar, reportar
            ni vaciar: el menu solo aparece cuando hay conversacion. */}
        {!!conversation && (
          <IconButton onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        )}
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
