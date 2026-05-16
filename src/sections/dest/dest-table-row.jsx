import { parsePhoneNumber } from 'libphonenumber-js';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { DestQuickEditForm } from './dest-quick-edit-form';

// ----------------------------------------------------------------------

export function DestTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();
  const capitalize = (text) =>
    (text || '')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const id = row.id || row.idDestacamento;
  const sectionalName = row.sectionalName || '';
  const regionalName = row.regionalName || '-';
  const coordinatorName = row.memberFullName || 'Desconocido';
  const coordinatorId = row.coordinatorId;
  const coordinatorAvatarUrl = row.coordinatorAvatarUrl;
  const coordinatorPhoneNumber = row.coordinatorPhoneNumber || '';
  const destMemberCount = row.destMemberCount || 0;

  const churchName =
    row?.churchName ||
    'Iglesia desconocida';


  const renderQuickEditForm = () => (
    <DestQuickEditForm
      currentDest={row}
      open={quickEditForm.value}
      onClose={quickEditForm.onFalse}
    />
  );

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <li>
          <MenuItem component={RouterLink} href={`/dashboard/level/dest/${id}/edit`}
            onClick={() => menuActions.onClose()}>
            <Iconify icon="solar:pen-bold" />
            Edit
          </MenuItem>
        </li>

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
      </MenuList>
    </CustomPopover>
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content="¿Seguro que deseas eliminar este destacamento?"
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            onDeleteRow();
            confirmDialog.onFalse();
          }}
        >
          Eliminar
        </Button>
      }
    />
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
                id: `${id}-checkbox`,
                'aria-label': `${id} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar alt={row.nombre}
              src={row.avatarUrl} />
            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={`/dashboard/level/dest/${id}/edit`}
                color="inherit"
                sx={{ cursor: 'pointer' }}
              >
                {`${capitalize(row.nombre)} ${row.numero || ''}`}

              </Link>
              {/* <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.email}
              </Box> */}
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {`Iglesia ${capitalize(churchName)}`}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.memberFullName}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar
              alt={coordinatorName}
              src={coordinatorAvatarUrl}
              sx={{ width: 40, height: 40 }}
            />
            <Stack sx={{ typography: 'body2', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={
                  coordinatorId
                    ? `/dashboard/level/member/${coordinatorId}/edit`
                    : '#'
                }
                color="inherit"
                sx={{ cursor: coordinatorId ? 'pointer' : 'default' }}
              >
                {capitalize(coordinatorName)}
              </Link>

              {/* <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.phoneNumber}
              </Box> */}
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {coordinatorPhoneNumber ? (() => {
                  try {
                    return coordinatorPhoneNumber
                      ? parsePhoneNumber(
                          coordinatorPhoneNumber.startsWith('+')
                            ? coordinatorPhoneNumber
                            : `+1${coordinatorPhoneNumber}`
                        )?.formatNational()
                      : '';
                  } catch {
                    return coordinatorPhoneNumber || '';
                  }
                })() : ''}
              </Box>
            </Stack>
          </Box>
        </TableCell>


        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.destMemberCount}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?dest=${id}`}
              color="inherit"
            >
              {destMemberCount}
            </Link>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sectionalName}</TableCell> */}

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/sectional?section=${encodeURIComponent(sectionalName)}`}
              color="inherit"
            >
              {sectionalName || '-'}
            </Link>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/regional?region=${row.regionalId || ''}`}
              color="inherit"
            >
              {regionalName}
            </Link>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Actualización rápida" placement="top" arrow>
              <IconButton
                color={quickEditForm.value ? 'inherit' : 'default'}
                onClick={quickEditForm.onTrue}
              >
                <Iconify icon="solar:pen-bold" />
              </IconButton>
            </Tooltip>

            <IconButton
              color={menuActions.open ? 'inherit' : 'default'}
              onClick={menuActions.onOpen}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        </TableCell>
      </TableRow>

      {renderQuickEditForm()}
      {renderMenuActions()}
      {renderConfirmDialog()}
    </>
  );
}
