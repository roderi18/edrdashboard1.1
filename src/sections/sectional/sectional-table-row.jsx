
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
import { parsePhoneNumber } from 'libphonenumber-js';
import { RouterLink } from 'src/routes/components';
import { getSectionals } from 'src/services/sectional-service';
import { getMembers } from 'src/services/member-service';
import { getLeadershipAssignments } from 'src/services/member-service';
import { getRegionals } from 'src/services/regional-service';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { REGIONALS } from 'src/_mock/assets';
import { useRouter } from 'next/navigation';
import { SectionalQuickEditForm } from './sectional-quick-edit-form';

// ----------------------------------------------------------------------

export function SectionalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();
  const router = useRouter();
  //  Primero obtenemos el sectional
  const sectionals = getSectionals();
  const sectional = sectionals.find((s) => s.id === row.id);

  //  Luego resolvemos la región
  const regionals = getRegionals();
  const regional = regionals.find((r) => r.id === sectional?.regionalId);

  const leaderships = getLeadershipAssignments();
  const directorAssignment = leaderships.find(
    (l) =>
      l.level === 'sectional' &&
      l.entityId === row.id &&
      l.role === 'director_sectional' &&
      l.status === 'active'
  );

  const members = getMembers();
  const director = members.find(
    (m) => m.id === directorAssignment?.memberId
  );

  const renderQuickEditForm = () => (
    <SectionalQuickEditForm
      currentSectional={row}
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
      content="Are you sure want to delete?"
      action={
        <Button variant="contained" color="error" onClick={onDeleteRow}>
          Delete
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
            <Avatar alt={row.sectionalName} src={row.avatarUrl} />

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={editHref}
                color="inherit"
                sx={{ cursor: 'pointer' }}
              >
                {row.sectionalName}
              </Link>
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {sectional?.email}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.memberFullName}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar
              alt={director?.fullName}
              src={director?.avatarUrl}
            />
            <Stack sx={{ typography: 'body2', alignItems: 'flex-start' }}>
              <Box
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.directorId) {
                    router.push(`/dashboard/level/member/${row.directorId}/edit`);
                  }
                }}
                sx={{
                  cursor: row.directorId ? 'pointer' : 'default',
                  color: row.directorId ? 'text.primary' : 'text.primary',
                  '&:hover': {
                    textDecoration: row.directorId ? 'underline' : 'none',
                  },
                }}
              >
                {director ? (
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/level/member/${director.id}/edit`);
                    }}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {director.fullName}
                  </Box>
                ) : (
                  'Desconocido'
                )}
              </Box>

              {/* <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.phoneNumber}
              </Box> */}
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {director?.phoneNumber
                  ? parsePhoneNumber(director.phoneNumber)?.formatNational()
                  : ''}
              </Box>
            </Stack>
          </Box>
        </TableCell>


        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sectionalDestCount}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/dest?sectional=${encodeURIComponent(row.sectionalName)}`}
              color="inherit"
            >
              {row.sectionalDestCount}
            </Link>
          </Box>
        </TableCell>

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.sectionalXDestMemberCount}</TableCell> */}
        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?sectional=${row.id}`}
              color="inherit"
            >
              {row.sectionalXDestMemberCount}
            </Link>
          </Box>
        </TableCell>

        {/* <TableCell>
          <Label
            variant="soft"
            color={
              (row.regionalName === 'Región Central' && 'success') ||
              (row.regionalName === 'Región Norte' && 'success') ||
              (row.regionalName === 'Región Sur' && 'success') ||
              'success'
            }
          >
            {row.regionalName}
          </Label>
        </TableCell> */}

        {/* <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {row.regionalName}
        </TableCell> */}

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/regional?sectional=${encodeURIComponent(regional?.name || '')}`}
              color="inherit"
            >
              {regional?.name || '-'}
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
