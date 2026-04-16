import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { getSectionals } from 'src/services/sectional-service';
import { getChurches } from 'src/services/church-service';
import { useState, useEffect } from 'react';

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
import { getMembers } from 'src/services/member-service';
import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { DestQuickEditForm } from './dest-quick-edit-form';

// ----------------------------------------------------------------------

export function DestTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();
  const [churches, setChurches] = useState([]);
  const [sectionals, setSectionals] = useState([]);
  const [members, setMembers] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const capitalize = (text) =>
    (text || '')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const regional = regionals.find(
    (r) => String(r.id) === String(sectional?.regionalId)
  );

  useEffect(() => {
    async function load() {
      const [churchesData, sectionalsData, membersData] = await Promise.all([
        getChurches(),
        getSectionals(),
        getMembers(),
      ]);

      setChurches(Array.isArray(churchesData) ? churchesData : []);
      setSectionals(Array.isArray(sectionalsData) ? sectionalsData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
    }

    load();
  }, []);

  const church = Array.isArray(churches)
    ? churches.find((c) => Number(c.id) === Number(row.idIglesia))
    : null;

  const sectionalName = church?.sectionalName || '';

  const sectional = sectionals.find(
    (s) => s.sectionalName === sectionalName
  );

  const coordinator = members.find(
    (m) => String(m.memberId) === String(row.coordinatorId)
  );

  const id = row.id || row.idDestacamento;

  const destMemberCount = members.filter((m) => {
    const match =
      m.idDestacamento !== null &&
      Number(m.idDestacamento) === Number(id);

    // if (match) {
    //   console.log('MATCH 👉', {
    //     memberId: m.idMiembros,
    //     memberDest: m.idDestacamento,
    //     rowId: id,
    //   });
    // }

    return match;
  }).length;

  const churchName =
    church?.name ||
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
              alt={
                coordinator
                  ? `${coordinator.firstName} ${coordinator.lastName}`
                  : ''
              }
              src={coordinator?.avatarUrl}
              sx={{ width: 40, height: 40 }}
            />
            <Stack sx={{ typography: 'body2', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={
                  coordinator
                    ? `/dashboard/level/member/${coordinator.id}/edit`
                    : '#'
                }
                color="inherit"
                sx={{ cursor: coordinator ? 'pointer' : 'default' }}
              >
                {coordinator
                  ? capitalize(`${coordinator.firstName} ${coordinator.lastName}`)
                  : 'Desconocido'}
              </Link>

              {/* <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.phoneNumber}
              </Box> */}
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {coordinator?.phoneNumber
                  ? parsePhoneNumber(coordinator.phoneNumber)?.formatNational()
                  : ''}
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
              {members.filter(
                (m) =>
                  m.idDestacamento !== null &&
                  Number(m.idDestacamento) === Number(row.id || row.idDestacamento)
              ).length}
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
              href={`/dashboard/level/regional?region=${regional?.id}`}
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
