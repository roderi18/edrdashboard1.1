import { useState, useCallback } from 'react';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Radio from '@mui/material/Radio';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import RadioGroup from '@mui/material/RadioGroup';
import Autocomplete from '@mui/material/Autocomplete';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import FormControlLabel from '@mui/material/FormControlLabel';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { CollapseButton } from './styles';
import { usePresenceStatuses } from './hooks/use-presence-status';
import { ChatRoomParticipantDialog } from './chat-room-participant-dialog';

// ----------------------------------------------------------------------

const MAX_VISIBLE_QUEUED_MEMBERS = 5;
const QUEUED_MEMBERS_MAX_HEIGHT = 170;
const MAX_VISIBLE_GROUP_PARTICIPANTS = 7;
const GROUP_PARTICIPANT_ROW_HEIGHT = 56;

export function ChatRoomGroup({
  participants,
  contacts = [],
  currentContact,
  // SI ESTO ES UN GRUPO DE VERDAD o un chat de dos. Este panel sale en los dos
  // —en cuanto hay dos personas hay una lista de participantes que enseñar—,
  // pero lo que se puede HACER no es lo mismo: en un chat de dos no hay
  // administradores, ni propiedad que transferir, ni grupo del que salir, y
  // agregar a alguien no es agregarlo aqui: es abrir un grupo nuevo con todos.
  esGrupo = true,
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyVisibility, setHistoryVisibility] = useState('none');
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
  // En un chat de dos cualquiera puede abrir un grupo con quien quiera: no hay
  // a quien pedirle permiso.
  const puedeAgregar = !esGrupo || isAdministrator;

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

  const handleAddMembers = useCallback(async (selectedHistoryVisibility = 'none') => {
    if (!newMembers.length) return;

    setAdding(true);

    try {
      await onAddParticipants?.(newMembers, selectedHistoryVisibility);
      setNewMembers([]);
      setHistoryDialogOpen(false);
      toast.success(esGrupo ? 'Miembros agregados al grupo.' : 'Grupo creado.');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo agregar a los miembros.');
    } finally {
      setAdding(false);
    }
  }, [esGrupo, newMembers, onAddParticipants]);

  const handleRequestAddMembers = useCallback(() => {
    if (!newMembers.length) return;

    if (!esGrupo) {
      void handleAddMembers('none');
      return;
    }

    setHistoryVisibility('none');
    setHistoryDialogOpen(true);
  }, [esGrupo, handleAddMembers, newMembers.length]);

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
    <Box
      sx={{
        ...(totalParticipants > MAX_VISIBLE_GROUP_PARTICIPANTS && {
          maxHeight: MAX_VISIBLE_GROUP_PARTICIPANTS * GROUP_PARTICIPANT_ROW_HEIGHT,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          overscrollBehavior: 'contain',
        }),
      }}
    >
      {participants.map((participant, index) => {
        const participantId = String(participant.idMiembros ?? participant.id);
        const status = presenceStatuses[participantId]?.status ?? 'offline';
        const isSelf =
          participantId === String(currentContact?.idMiembros ?? currentContact?.id ?? '');
        const participantIsCreator = participantId === String(creatorIdMiembros ?? '');
        const participantIsAdmin = administratorIdSet.has(participantId);
        const canRemove =
          esGrupo &&
          ((!participantIsCreator && isSelf) ||
            (isCreator && !isSelf) ||
            (isAdministrator && !participantIsAdmin && !isSelf));
        const participantRole = !esGrupo
          ? 'Miembro'
          : participantIsCreator
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

            {esGrupo && isCreator && !isSelf && onSetGroupAdministrator && (
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

            {esGrupo && isCreator && !isSelf && onTransferGroupOwnership && (
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
    </Box>
  );

  const renderAddMember = () =>
    puedeAgregar && onAddParticipants && (
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
          sx={{
            '& .MuiAutocomplete-inputRoot': {
              alignContent: 'flex-start',
              ...(newMembers.length > MAX_VISIBLE_QUEUED_MEMBERS && {
                maxHeight: QUEUED_MEMBERS_MAX_HEIGHT,
                overflowY: 'auto',
                scrollbarWidth: 'thin',
                overscrollBehavior: 'contain',
              }),
            },
          }}
          renderInput={(params) => (
            <TextField {...params} placeholder={esGrupo ? 'Agregar miembro' : 'Crear un grupo con'} />
          )}
          // CON SU CARA, como en "+ Destinatarios" y como en la lista de arriba.
          // Era una lista de nombres a secas, y en un destacamento hay nombres
          // que se parecen: quien elige a alguien para meterlo en un grupo lo
          // reconoce por la foto antes que por el apellido.
          renderOption={(props, option) => {
            const { key, ...otherProps } = props;

            return (
              <Box component="li" key={key} {...otherProps} sx={{ gap: 1 }}>
                <Avatar
                  alt={option.name}
                  src={option.avatarUrl}
                  slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
                  sx={{ width: 32, height: 32 }}
                />
                {option.name}
              </Box>
            );
          }}
          renderValue={(elegidos, getItemProps) =>
            elegidos.map((option, index) => (
              <Chip
                {...getItemProps({ index })}
                key={option.id}
                size="small"
                variant="soft"
                label={option.name}
                avatar={<Avatar alt={option.name} src={option.avatarUrl} />}
                sx={{
                  minWidth: 0,
                  maxWidth: 'calc(100% - 6px)',
                  flexBasis: 'calc(100% - 6px)',
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            ))
          }
        />

        {!!newMembers.length && (
          // CONFIRMAR SE TIENE QUE VER. Era una palomita fina y del color del
          // texto en una esquina: el paso que remata la operacion parecia un
          // adorno. Redonda, rellena y del color de la casa se lee como lo que
          // es —el boton que hay que pulsar— sin necesitar una etiqueta.
          <Tooltip title={esGrupo ? 'Agregar al grupo' : 'Crear el grupo'}>
            <IconButton
              disabled={adding}
              onClick={handleRequestAddMembers}
              aria-label={esGrupo ? 'Agregar al grupo' : 'Crear el grupo'}
              sx={{
                alignSelf: 'flex-end',
                color: 'common.white',
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { color: 'common.white', opacity: 0.48, bgcolor: 'primary.main' },
              }}
            >
              <Iconify icon="eva:checkmark-fill" width={22} sx={{ strokeWidth: 2 }} />
            </IconButton>
          </Tooltip>
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
        open={historyDialogOpen}
        title="¿Qué mensajes podrán ver?"
        onClose={() => !adding && setHistoryDialogOpen(false)}
        content={
          <RadioGroup
            value={historyVisibility}
            onChange={(event) => setHistoryVisibility(event.target.value)}
            sx={{ mt: 1 }}
          >
            <FormControlLabel
              value="none"
              control={<Radio />}
              label="Ningún mensaje anterior"
            />
            <FormControlLabel
              value="last_hour"
              control={<Radio />}
              label="Mensajes de la última hora"
            />
            <FormControlLabel
              value="all"
              control={<Radio />}
              label="Todo el historial"
            />
          </RadioGroup>
        }
        action={
          <Button
            variant="contained"
            loading={adding}
            onClick={() => handleAddMembers(historyVisibility)}
          >
            Agregar al grupo
          </Button>
        }
      />

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
