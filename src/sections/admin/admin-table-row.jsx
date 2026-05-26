import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { AdminPermissionsDialog } from './admin-permissions-dialog';

// ----------------------------------------------------------------------

export function AdminTableRow({
  row,
  selected,
  onSelectRow,
  onAssignAdmin,
  onRemoveAdmin,
  onPermissionsSaved,
}) {
  const menuActions = usePopover();
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);

  const isAdminActive =
    Boolean(row.adminId || row.esAdministrador) ||
    ['admin', 'administrador'].includes(String(row.rol || row.role || '').toLowerCase());

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <MenuItem
          onClick={() => {
            menuActions.onClose();

            if (isAdminActive) {
              onRemoveAdmin?.(row);
            } else {
              onAssignAdmin?.(row);
            }
          }}
        >
          <Iconify icon={isAdminActive ? 'solar:user-minus-bold' : 'solar:user-plus-bold'} />
          {isAdminActive ? 'Quitar administrador' : 'Asignar administrador'}
        </MenuItem>

        <MenuItem
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            setOpenPermissionsDialog(true);
            menuActions.onClose();
          }}
        >
          <Iconify icon="solar:shield-keyhole-bold" />
          Ver permisos
        </MenuItem>

        <MenuItem onClick={menuActions.onClose}>
          <Iconify icon="solar:history-2-bold" />
          Historial de cambios
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <TableRow hover selected={selected} aria-checked={selected} tabIndex={-1}>
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onClick={onSelectRow}
            slotProps={{
              input: {
                id: `${row.id}-checkbox`,
                'aria-label': `${row.name} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar alt={row.name} src={row.avatarUrl} />

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Box component="span">{row.name}</Box>
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.email || row.correo || '-'}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        <TableCell>{row.memberCode || row.codigoMiembro || '-'}</TableCell>

        <TableCell>{row.idMiembros || row.memberId || '-'}</TableCell>

        <TableCell>
          <Label
            color={row.estatus === 'activo' || row.status === 'active' ? 'success' : 'default'}
          >
            {row.estatus || row.status || 'activo'}
          </Label>
        </TableCell>

        <TableCell>{row.rol || row.role || 'admin'}</TableCell>

        <TableCell align="right">
          <IconButton color="default" onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      {renderMenuActions()}

      <AdminPermissionsDialog
        open={openPermissionsDialog}
        admin={row}
        onClose={() => setOpenPermissionsDialog(false)}
        onSaved={(permissions) => onPermissionsSaved?.(row, permissions)}
      />
    </>
  );
}
