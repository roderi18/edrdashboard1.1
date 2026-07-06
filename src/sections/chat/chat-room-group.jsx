import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { CollapseButton } from './styles';
import { usePresenceStatuses } from './hooks/use-presence-status';
import { ChatRoomParticipantDialog } from './chat-room-participant-dialog';

// ----------------------------------------------------------------------

export function ChatRoomGroup({
  participants,
  contacts = [],
  currentContact,
  creatorIdMiembros,
  onAddParticipants,
  onRemoveParticipant,
}) {
  const collapse = useBoolean(true);

  const [selected, setSelected] = useState(null);
  const [newMembers, setNewMembers] = useState([]);
  const [adding, setAdding] = useState(false);

  const presenceStatuses = usePresenceStatuses(
    participants.map((participant) => participant.idMiembros ?? participant.id)
  );

  const isCreator =
    !!creatorIdMiembros &&
    String(creatorIdMiembros) === String(currentContact?.idMiembros ?? currentContact?.id);

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
        await onRemoveParticipant?.(participant.idMiembros ?? participant.id);
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudo quitar al participante.');
      }
    },
    [onRemoveParticipant]
  );

  const totalParticipants = participants.length;

  const renderList = () => (
    <>
      {participants.map((participant, index) => {
        const participantId = String(participant.idMiembros ?? participant.id);
        const status = presenceStatuses[participantId]?.status ?? 'offline';
        const isSelf =
          participantId === String(currentContact?.idMiembros ?? currentContact?.id ?? '');
        const canRemove = isCreator || isSelf;

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
              secondary={participant.role}
              slotProps={{
                primary: { noWrap: true },
                secondary: { noWrap: true, sx: { typography: 'caption' } },
              }}
              sx={{ ml: 2 }}
            />

            {canRemove && onRemoveParticipant && (
              <IconButton size="small" onClick={(event) => handleRemove(participant, event)}>
                <Iconify icon="solar:trash-bin-trash-bold" width={18} />
              </IconButton>
            )}
          </ListItemButton>
        );
      })}
    </>
  );

  const renderAddMember = () =>
    onAddParticipants && (
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
    </>
  );
}
