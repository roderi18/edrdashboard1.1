import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { CollapseButton } from './styles';
import { usePresenceStatuses } from './hooks/use-presence-status';
import { ChatRoomParticipantDialog } from './chat-room-participant-dialog';

// ----------------------------------------------------------------------

export function ChatRoomGroup({
  participants,
  contacts = [],
  currentContact,
  creatorIdMiembros,
  administratorIds = [],
  onAddParticipants,
  onRemoveParticipant,
  onLeaveGroup,
  onSetGroupAdministrator,
  onTransferGroupOwnership,
}) {
  const collapse = useBoolean(true);

  const [selected, setSelected] = useState(null);
  const [newMembers, setNewMembers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);

  const presenceStatuses = usePresenceStatuses(
    participants.map((participant) => participant.idMiembros ?? participant.id)
  );

  const isCreator =
    !!creatorIdMiembros &&
    String(creatorIdMiembros) === String(currentContact?.idMiembros ?? currentContact?.id);
  const currentMemberId = String(currentContact?.idMiembros ?? currentContact?.id ?? '');
  const administratorIdSet = new Set(administratorIds.map(String));
  const isAdministrator = isCreator || administratorIdSet.has(currentMemberId);

  const availableContacts = contacts.filter(
    (contact) =>
      !participants.some(
        (participant) => String(participant.idMiembros ?? participant.id) === String(contact.id)
      )
  );

  const handleOpen = useCallback((participant) => {
    setSelected(participant);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
  }, []);

  const handleAddMembers = useCallback(async () => {
    if (!newMembers.length) return;

    setAdding(true);

    try {
      await onAddParticipants?.(newMembers);
      setNewMembers([]);
      toast.success('Miembros agregados al grupo.');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo agregar a los miembros.');
    } finally {
      setAdding(false);
    }
  }, [newMembers, onAddParticipants]);

  const handleRemove = useCallback(
    async (participant, event) => {
      event.stopPropagation();

      try {
        const participantId = String(participant.idMiembros ?? participant.id);

        if (participantId === currentMemberId) {
          await onLeaveGroup?.();
        } else {
          await onRemoveParticipant?.(participant.idMiembros ?? participant.id);
        }
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudo quitar al participante.');
      }
    },
    [currentMemberId, onLeaveGroup, onRemoveParticipant]
  );

  const handleSetAdministrator = useCallback(
    async (participant, makeAdmin, event) => {
      event.stopPropagation();
      setGroupActionLoading(true);

      try {
        await onSetGroupAdministrator?.(
          participant.idMiembros ?? participant.id,
          makeAdmin
        );
        toast.success(makeAdmin ? 'Administrador asignado.' : 'Administrador retirado.');
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudo cambiar el rol del participante.');
      } finally {
        setGroupActionLoading(false);
      }
    },
    [onSetGroupAdministrator]
  );

  const handleTransferOwnership = useCallback(async () => {
    if (!transferTarget) return;
    setGroupActionLoading(true);

    try {
      await onTransferGroupOwnership?.(
        transferTarget.idMiembros ?? transferTarget.id
      );
      toast.success('Propiedad del grupo transferida.');
      setTransferTarget(null);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo transferir la propiedad del grupo.');
    } finally {
      setGroupActionLoading(false);
    }
  }, [onTransferGroupOwnership, transferTarget]);

  const totalParticipants = participants.length;

  const renderList = () => (
    <>
      {participants.map((participant, index) => {
        const participantId = String(participant.idMiembros ?? participant.id);
        const status = presenceStatuses[participantId]?.status ?? 'offline';
        const isSelf =
          participantId === String(currentContact?.idMiembros ?? currentContact?.id ?? '');
        const participantIsCreator = participantId === String(creatorIdMiembros ?? '');
        const participantIsAdmin = administratorIdSet.has(participantId);
        const canRemove =
          (!participantIsCreator && isSelf) ||
          (isCreator && !isSelf) ||
          (isAdministrator && !participantIsAdmin && !isSelf);
        const participantRole = participantIsCreator
          ? 'Creador'
          : participantIsAdmin
            ? 'Administrador'
            : 'Miembro';

        return (
          <ListItemButton
            key={`${participant.id ?? participant.idMiembros ?? participant.name ?? 'participante'}-${index}`}
            onClick={() => handleOpen(participant)}
          >
            <Badge
              variant={status}
              badgeContent=" "
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <Avatar alt={participant.name} src={participant.avatarUrl} />
            </Badge>

            <ListItemText
              primary={participant.name}
              secondary={participantRole}
              slotProps={{
                primary: { noWrap: true },
                secondary: { noWrap: true, sx: { typography: 'caption' } },
              }}
              sx={{ ml: 2 }}
            />

            {canRemove && onRemoveParticipant && (
              <Tooltip title={isSelf ? 'Salir del grupo' : 'Quitar del grupo'}>
                <IconButton size="small" onClick={(event) => handleRemove(participant, event)}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Tooltip>
            )}

            {isCreator && !isSelf && onSetGroupAdministrator && (
              <Tooltip title={participantIsAdmin ? 'Quitar administrador' : 'Hacer administrador'}>
                <IconButton
                  size="small"
                  disabled={groupActionLoading}
                  onClick={(event) =>
                    handleSetAdministrator(participant, !participantIsAdmin, event)
                  }
                >
                  <Iconify
                    icon={participantIsAdmin ? 'solar:shield-minus-bold' : 'solar:shield-plus-bold'}
                    width={18}
                  />
                </IconButton>
              </Tooltip>
            )}

            {isCreator && !isSelf && onTransferGroupOwnership && (
              <Tooltip title="Transferir propiedad">
                <IconButton
                  size="small"
                  disabled={groupActionLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    setTransferTarget(participant);
                  }}
                >
                  <Iconify icon="solar:crown-bold" width={18} />
                </IconButton>
              </Tooltip>
            )}
          </ListItemButton>
        );
      })}
    </>
  );

  const renderAddMember = () =>
    isAdministrator && onAddParticipants && (
      <Box sx={{ gap: 1, px: 2, py: 1.5, display: 'flex', flexDirection: 'column' }}>
        <Autocomplete
          multiple
          size="small"
          value={newMembers}
          options={availableContacts}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(event, value) => setNewMembers(value)}
          noOptionsText="No hay más contactos para agregar"
          renderInput={(params) => <TextField {...params} placeholder="Agregar miembro" />}
        />

        {!!newMembers.length && (
          <IconButton
            color="primary"
            disabled={adding}
            onClick={handleAddMembers}
            sx={{ alignSelf: 'flex-end' }}
          >
            <Iconify icon="eva:checkmark-fill" />
          </IconButton>
        )}
      </Box>
    );

  return (
    <>
      <CollapseButton
        selected={collapse.value}
        disabled={!totalParticipants}
        onClick={collapse.onToggle}
      >
        {`En la conversación (${totalParticipants})`}
      </CollapseButton>

      <Collapse in={collapse.value}>
        {renderList()}
        {renderAddMember()}
      </Collapse>

      {selected && (
        <ChatRoomParticipantDialog participant={selected} open={!!selected} onClose={handleClose} />
      )}

      <ConfirmDialog
        open={!!transferTarget}
        title="Transferir propiedad del grupo"
        onClose={() => setTransferTarget(null)}
        content={`¿Deseas convertir a ${transferTarget?.name || 'este participante'} en creador del grupo? Conservarás el rol de administrador.`}
        action={
          <Button variant="contained" loading={groupActionLoading} onClick={handleTransferOwnership}>
            Transferir propiedad
          </Button>
        }
      />
    </>
  );
}
