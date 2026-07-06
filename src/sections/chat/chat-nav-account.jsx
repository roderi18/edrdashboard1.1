import { usePopover } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import Badge, { badgeClasses } from '@mui/material/Badge';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { useAuthContext } from 'src/auth/hooks';

import { usePresenceStatus } from './hooks/use-presence-status';
import { PRESENCE_STATUS_OPTIONS } from './utils/presence-labels';
import { usePresenceHeartbeat } from './hooks/use-presence-heartbeat';

// ----------------------------------------------------------------------

const STATUS_OPTIONS = PRESENCE_STATUS_OPTIONS;

const StatusDot = ({ variant }) => (
  <Badge
    variant={variant}
    badgeContent=" "
    sx={{
      width: 12,
      height: 12,
      flexShrink: 0,
      [`& .${badgeClasses.badge}`]: {
        width: 10,
        height: 10,
        transform: 'unset',
        position: 'static',
      },
    }}
  />
);

export function ChatNavAccount({ currentContact }) {
  const { user } = useAuthContext();
  const photoURL = currentContact?.avatarUrl || user?.photoURL || '';

  const menuActions = usePopover();

  const idMiembros = currentContact?.idMiembros;
  const { setManualOverride } = usePresenceHeartbeat(idMiembros);
  const ownPresence = usePresenceStatus(idMiembros);
  const [status, setStatus] = useState('online');

  useEffect(() => {
    if (ownPresence.status) setStatus(ownPresence.status);
  }, [ownPresence.status]);

  const handleChangeStatus = useCallback(
    (event) => {
      const nextStatus = event.target.value;
      setStatus(nextStatus);
      setManualOverride(nextStatus);
    },
    [setManualOverride]
  );

  // "offline" solo es automático: si el estado actual es offline, el desplegable
  // muestra "En línea" como valor seleccionable sin generar un valor fuera de rango.
  const selectValue = STATUS_OPTIONS.some((option) => option.value === status) ? status : 'online';

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{
        paper: { sx: { p: 0, ml: 0, mt: 0.5 } },
        arrow: { placement: 'top-left' },
      }}
    >
      <Box
        sx={{
          py: 2,
          pr: 1,
          pl: 2,
          gap: 2,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <ListItemText primary={user?.displayName} secondary={user?.email} />
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box sx={{ p: 2, pb: 1 }}>
        <FormControl fullWidth size="small">
          <InputLabel htmlFor="chat-status-select">Estado</InputLabel>
          <Select
            label="Estado"
            value={selectValue}
            onChange={handleChangeStatus}
            inputProps={{ id: 'chat-status-select' }}
            renderValue={(value) => (
              <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
                <StatusDot variant={value} />
                {STATUS_OPTIONS.find((option) => option.value === value)?.label}
              </Box>
            )}
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value} sx={{ gap: 1 }}>
                <StatusDot variant={option.value} />
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <MenuList sx={{ my: 0.5, px: 0.5 }}>
        <MenuItem>
          <Iconify width={24} icon="solar:user-id-bold" />
          Perfil
        </MenuItem>

        <MenuItem>
          <Iconify width={24} icon="solar:settings-bold" />
          Configuración
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Badge
        variant={status}
        badgeContent=" "
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Avatar
          src={photoURL}
          alt={user?.displayName}
          onClick={menuActions.onOpen}
          sx={{ cursor: 'pointer', width: 48, height: 48 }}
        >
          {user?.displayName?.charAt(0).toUpperCase()}
        </Avatar>
      </Badge>

      {renderMenuActions()}
    </>
  );
}
