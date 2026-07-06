'use client';

import { m } from 'framer-motion';
import { usePopover } from 'minimal-shared/hooks';

import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
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

// ----------------------------------------------------------------------

export function ContactsPopover({ data = [], sx, ...other }) {
  const { open, anchorEl, onClose, onOpen } = usePopover();

  const presenceStatuses = usePresenceStatuses(data.map((contact) => contact.idMiembros ?? contact.id));

  const renderMenuList = () => (
    <CustomPopover open={open} anchorEl={anchorEl} onClose={onClose}>
      <Typography variant="h6" sx={{ p: 1.5 }}>
        Contactos <span>({data.length})</span>
      </Typography>

      <Scrollbar sx={{ height: 320, width: 320 }}>
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
        onClick={onOpen}
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
