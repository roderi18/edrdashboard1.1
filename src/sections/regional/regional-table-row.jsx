import { useState, useEffect } from 'react';
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

import { getMembers } from 'src/services/member-service';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { RegionalQuickEditForm } from './regional-quick-edit-form';

// ----------------------------------------------------------------------

export function RegionalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    async function loadMembers() {
      const data = await getMembers();
      setMembers(data);
    }

    loadMembers();
  }, []);

  const directorAssignment = LEADERSHIP_ASSIGNMENTS.find(
    (l) =>
      l.level === 'regional' &&
      l.entityId === row.id &&
      l.role === 'director_regional' &&
      l.status === 'active'
  );

  const director = members.find(
    (m) => m.id === directorAssignment?.memberId
  );

  const renderQuickEditForm = () => (
    <RegionalQuickEditForm
      currentRegional={row}
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
          <MenuItem component={RouterLink} href={editHref} onClick={() => menuActions.onClose()}>
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
      content="¿Seguro que deseas eliminar esta regional?"
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
                id: `${row.id}-checkbox`,
                'aria-label': `${row.id} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar
              alt={row.regionalName}
              src={row.avatarUrl || undefined}
            >
              {!row.avatarUrl && row.regionalName?.[0]}
            </Avatar>

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={editHref}
                color="inherit"
                sx={{ cursor: 'pointer' }}
              >
                {row.regionalName}
              </Link>
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.email}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar
              alt={director?.fullName}
              src={director?.avatarUrl || undefined}
            >
              {!director?.avatarUrl && director?.fullName?.[0]}
            </Avatar>
            <Stack sx={{ typography: 'body2', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={
                  director
                    ? `/dashboard/level/member/${director.id}/edit`
                    : '#'
                }
                color="inherit"
                sx={{ cursor: director ? 'pointer' : 'default' }}
              >
                {director?.fullName || 'Desconocido'}
              </Link>

              <Box component="span" sx={{ color: 'text.disabled' }}>
                {(() => {
                  try {
                    return director?.phoneNumber
                      ? parsePhoneNumber(
                        director.phoneNumber.startsWith('+')
                          ? director.phoneNumber
                          : `+1${director.phoneNumber}`
                      )?.formatNational()
                      : '';
                  } catch (e) {
                    return director?.phoneNumber || '';
                  }
                })()}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.regionalXSectionalCount}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/sectional?region=${encodeURIComponent(row.regionalName)}`}
              color="inherit"
            >
              {row.regionalXSectionalCount}
            </Link>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.regionalXSectionalXDestCount}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/dest?region=${row.id}`}
              color="inherit"
            >
              {row.regionalXSectionalXDestCount}
            </Link>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.regionalXSectionalMemberCount}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?region=${row.id}`}
              color="inherit"
            >
              {row.regionalXSectionalMemberCount}
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
