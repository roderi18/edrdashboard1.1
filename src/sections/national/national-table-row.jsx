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

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { NationalQuickEditForm } from './national-quick-edit-form';
import { MEMBERS, REGIONALS, SECTIONALS, DESTS } from 'src/_mock/assets';
import { getStorageCollection } from 'src/utils/storage-service';
import { _leadershipRolesByLevel } from 'src/_mock/_leadership';
import { _allLeadershipRoles } from 'src/_mock/_leadership';
// ----------------------------------------------------------------------

export function NationalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];
  const storedMembers = getStorageCollection('members') || [];
  const allMembers = [...MEMBERS, ...storedMembers];
  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();

  const assignment = leadershipAssignments.find(
    (l) =>
      l.memberId === row.memberId &&
      ['national', 'regional', 'sectional'].includes(l.level) &&
      l.status === 'active'
  ); console.log('ASSIGNMENT ENCONTRADO:', assignment);

  const roleValue = assignment?.role || row.nationalXMemberPosition;
  console.log('ROLE VALUE:', roleValue);

  const roleConfig = _allLeadershipRoles.find(
    (r) => r.value === roleValue
  );

  const member = allMembers.find(
    (m) =>
      m.id === row.memberId ||
      m.memberId === row.memberId
  );

  const NATIONAL_STRUCTURES = {
    ministerios_infantiles: 'Ministerios Infantiles',
    consejo_ejecutivo: 'Consejo Ejecutivo',
    oficiales_especiales_nacionales: 'Oficiales Especiales Nacionales',
    directivas_regionales: 'Directivas Regionales',
    directivas_seccionales: 'Directivas Seccionales',
    directivas_zonales: 'Directivas Zonales',
    // directiva_local: 'Directiva Local',
  };

  const structureLabel = NATIONAL_STRUCTURES[roleConfig?.structure] || '-';
  console.log('STRUCTURE:', roleConfig?.structure);


  const resolveRegionalNameFromMember = (m) => {
    if (!m) return '-';

    // 1) Si el miembro ya tiene regionalId
    const directRegional = REGIONALS.find((r) => r.id === m.regionalId);
    if (directRegional) return directRegional.name;

    // 2) Si tiene sectionalId
    const sectional = SECTIONALS.find((s) => s.id === m.sectionalId);
    if (sectional) {
      const regional = REGIONALS.find((r) => r.id === sectional.regionalId);
      return regional?.name || '-';
    }

    // 3) Si tiene destId
    const dest = DESTS.find((d) => d.id === m.destId);
    if (dest) {
      const sec = SECTIONALS.find((s) => s.id === dest.sectionalId);
      const regional = REGIONALS.find((r) => r.id === sec?.regionalId);
      return regional?.name || '-';
    }

    return '-';
  };

  const regionalName = resolveRegionalNameFromMember(member);

  const renderQuickEditForm = () => (
    <NationalQuickEditForm
      currentNational={row}
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
            <Avatar alt={row.nationalXname} src={row.avatarUrl} />

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={member ? `/dashboard/level/member/${member.memberId}/edit` : '#'}
                color="inherit"
                sx={{ cursor: member ? 'pointer' : 'default' }}
              >
                {member?.fullName || row.nationalXname || 'Desconocido'}
              </Link>
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {member?.email || row.email || ''}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {member?.phoneNumber ? parsePhoneNumber(member.phoneNumber)?.formatNational() : ''}
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {roleConfig?.label || row.nationalXMemberPositionLabel || '-'}
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {structureLabel}
        </TableCell>

        {/* <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={regionalName !== '-' ? `/dashboard/level/regional?region=${encodeURIComponent(regionalName)}` : '#'}
              color="inherit"
              sx={{ cursor: regionalName !== '-' ? 'pointer' : 'default' }}
            >
              {regionalName}
            </Link>
          </Box>
        </TableCell> */}


        {/* <TableCell>
          <Label
            variant="soft"
            color={ //etiquetas / badgets
              (row.status === 'active' && 'success') ||
              (row.status === 'pending' && 'warning') ||
              (row.status === 'banned' && 'error') ||
              'default'
            }
          >
            {row.status}
          </Label>
        </TableCell> */}

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
