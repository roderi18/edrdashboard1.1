
import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { useEffect, useState } from 'react';
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
import { getDests } from 'src/services/dest-service';
import { getChurches } from 'src/services/church-service';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';
import { useRouter } from 'next/navigation';
import { SectionalQuickEditForm } from './sectional-quick-edit-form';

// ----------------------------------------------------------------------

export function SectionalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {

  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();
  const router = useRouter();

  useEffect(() => {
    async function loadMembers() {
      const data = await getMembers();
      setMembers(data);
    }

    loadMembers();
  }, []);

  useEffect(() => {
    async function load() {
      const data = await getSectionals();
      setSectionals(data);
    }
    load();
  }, []);

  const [sectionals, setSectionals] = useState([]);
  const sectional = sectionals.find((s) => s.id === row.id);

  const [members, setMembers] = useState([]);
  const dests = getDests();
  const churches = getChurches();


  const director = members.find(
    (m) => String(m.id) === String(row.directorId)
  );

  const destsBySectional = dests.filter((d) => {
    const church = churches.find((c) => c.id === d.churchId);
    return church?.sectionalName === row.sectionalName;
  });

  const totalDests = destsBySectional.length;

  const totalMembers = members.filter((m) =>
    destsBySectional.some((d) => d.id === m.destId)
  ).length;

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

  const capitalize = (text = '') =>
    text
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <>
      <TableRow selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onChange={onSelectRow}
            slotProps={{
              input: { id: `checkbox-${row.id}` },
            }}
          />

        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar
              alt={capitalize(row.sectionalName || '')}
              src={row.avatarUrl}
            />

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Link
                component={RouterLink}
                href={editHref}
                color="inherit"
                sx={{ cursor: 'pointer' }}
              >
                {capitalize(sectional?.sectionalName || '') || '-'}
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
              alt={`${director?.firstName || ''} ${director?.lastName || ''}`}
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
                      router.push(`/dashboard/level/member/${director.memberId}/edit`);
                    }}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {`${director.firstName || ''} ${director.lastName || ''}`}
                  </Box>
                ) : (
                  'Desconocido'
                )}
              </Box>

              {/* <Box component="span" sx={{ color: 'text.disabled' }}>
                {row.phoneNumber}
              </Box> */}
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


        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/dest?sectional=${encodeURIComponent(row.sectionalName)}`}
              color="inherit"
            >
              {totalDests}
            </Link>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?sectional=${row.id}`}
              color="inherit"
            >
              {totalMembers}
            </Link>
          </Box>
        </TableCell>


        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Link
              component={RouterLink}
              href={`/dashboard/level/regional?sectional=${encodeURIComponent(row.regionalName || '')}`}
              color="inherit"
            >
              {row.regionalName || '-'}
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
