import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

export function CompactEntityRowActions({
  canManage = true,
  allowDelete = true,
  editHref,
  onDelete,
  QuickEditForm,
  quickEditProps,
  deleteContent,
  deleteTitle = 'Eliminar',
  quickEditTitle = 'Actualización rápida',
}) {
  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();

  return (
    <TableCell>
      {canManage && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {QuickEditForm && (
            <Tooltip title={quickEditTitle} placement="top" arrow>
              <IconButton
                color={quickEditForm.value ? 'inherit' : 'default'}
                onClick={quickEditForm.onTrue}
              >
                <Iconify icon="solar:pen-bold" />
              </IconButton>
            </Tooltip>
          )}

          <IconButton color={menuActions.open ? 'inherit' : 'default'} onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </Box>
      )}

      {canManage && QuickEditForm && (
        <QuickEditForm
          {...quickEditProps}
          open={quickEditForm.value}
          onClose={quickEditForm.onFalse}
        />
      )}

      {canManage && (
        <CustomPopover
          open={menuActions.open}
          anchorEl={menuActions.anchorEl}
          onClose={menuActions.onClose}
          slotProps={{ arrow: { placement: 'right-top' } }}
        >
          <MenuList>
            <li>
              <MenuItem
                component={RouterLink}
                href={editHref}
                onClick={() => menuActions.onClose()}
              >
                <Iconify icon="solar:pen-bold" />
                Edit
              </MenuItem>
            </li>

            {allowDelete && (
              <MenuItem
                onClick={() => {
                  confirmDialog.onTrue();
                  menuActions.onClose();
                }}
                sx={{ color: 'error.main' }}
              >
                <Iconify icon="solar:trash-bin-trash-bold" />
                Delete
              </MenuItem>
            )}
          </MenuList>
        </CustomPopover>
      )}

      {canManage && allowDelete && (
        <ConfirmDialog
          open={confirmDialog.value}
          onClose={confirmDialog.onFalse}
          title={deleteTitle}
          content={deleteContent}
          action={
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                onDelete?.();
                confirmDialog.onFalse();
              }}
            >
              Eliminar
            </Button>
          }
        />
      )}
    </TableCell>
  );
}
