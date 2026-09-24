'use client';

import { m } from 'framer-motion';
import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';

import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';

import { fToNow } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomPopover } from 'src/components/custom-popover';
import { varTap, varHover, transitionTap } from 'src/components/animate';

import { usePresenceStatuses } from 'src/sections/chat/hooks/use-presence-status';

import { cargarContactosDelDestacamento } from './contactos-del-destacamento';

// ----------------------------------------------------------------------

// Los contactos se piden al abrir (o al pasar por encima del botón, para que al
// pulsar ya estén). Antes los calculaba el layout en cada arranque con el padrón
// entero. `data`, si se pasa, manda (compatibilidad).
export function ContactsPopover({ data: datosDados, usuario, sx, ...other }) {
  const { open, anchorEl, onClose, onOpen } = usePopover();
  const [contactos, setContactos] = useState(null);
  const pedidoRef = useRef(null);

  const pedirContactos = useCallback(() => {
    if (datosDados || pedidoRef.current) return;

    pedidoRef.current = cargarContactosDelDestacamento(usuario)
      .then(setContactos)
      .catch((error) => {
        console.error('Error cargando contactos del destacamento:', error);
        setContactos([]);
      });
  }, [datosDados, usuario]);

  // Otra cuenta, otros contactos.
  useEffect(() => {
    pedidoRef.current = null;
    setContactos(null);
  }, [usuario]);

  const data = datosDados ?? contactos ?? [];
  const cargando = !datosDados && contactos === null;

  // La presencia (escuchas en vivo) solo mientras el popover está abierto: antes
  // se escuchaba a todo el destacamento desde el arranque.
  const presenceStatuses = usePresenceStatuses(
    open ? data.map((contact) => contact.idMiembros ?? contact.id) : []
  );

  const renderMenuList = () => (
    <CustomPopover open={open} anchorEl={anchorEl} onClose={onClose}>
      <Typography variant="h6" sx={{ p: 1.5 }}>
        Contactos {!cargando && <span>({data.length})</span>}
      </Typography>

      <Scrollbar sx={{ height: 320, width: 320 }}>
        {cargando && (
          <Stack spacing={1.5} sx={{ p: 1 }}>
            {[0, 1, 2, 3, 4].map((fila) => (
              <Stack key={fila} direction="row" spacing={1.5} alignItems="center">
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton variant="text" sx={{ flex: 1 }} />
              </Stack>
            ))}
          </Stack>
        )}

        <MenuList>
          {data.map((contact) => {
            const presence = presenceStatuses[String(contact.idMiembros ?? contact.id)] ?? {
              status: 'offline',
              lastActivity: null,
            };

            return (
              <MenuItem key={contact.id} sx={{ p: 1 }}>
                <Badge
                  variant={presence.status}
                  badgeContent=" "
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                  <Avatar alt={contact.name} src={contact.avatarUrl} />
                </Badge>

                <ListItemText
                  primary={contact.name}
                  secondary={presence.status === 'offline' ? fToNow(presence.lastActivity) : ''}
                  slotProps={{
                    secondary: {
                      sx: { typography: 'caption', color: 'text.disabled' },
                    },
                  }}
                />
              </MenuItem>
            );
          })}
        </MenuList>
      </Scrollbar>
    </CustomPopover>
  );

  return (
    <>
      <IconButton
        component={m.button}
        whileTap={varTap(0.96)}
        whileHover={varHover(1.04)}
        transition={transitionTap()}
        aria-label="Contacts button"
        onPointerEnter={pedirContactos}
        onFocus={pedirContactos}
        onClick={(event) => {
          pedirContactos();
          onOpen(event);
        }}
        sx={[
          (theme) => ({ ...(open && { bgcolor: theme.vars.palette.action.selected }) }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        <Iconify icon="solar:users-group-rounded-bold-duotone" width={24} />
      </IconButton>

      {renderMenuList()}
    </>
  );
}
