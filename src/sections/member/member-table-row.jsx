import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { resolveById } from 'src/utils/resolve-display-name';
import { getDests } from 'src/services/dest-service';
import { SECTIONALS } from 'src/_mock/assets';
import { getChurches } from 'src/services/church-service';
import { getStorageCollection } from 'src/utils/storage-service';
import { _allLeadershipRoles } from 'src/_mock/_leadership';

import Box from '@mui/material/Box';
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
import { useState, useEffect } from 'react';
import { UnderlineLink } from 'src/components/link/underline-link';

import { RouterLink } from 'src/routes/components';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { MemberQuickEditForm } from './member-quick-edit-form';

// ----------------------------------------------------------------------

export function MemberTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const [dests, setDests] = useState([]);

  useEffect(() => {
    setDests(getDests());
  }, []);

  const menuActions = usePopover();
  const confirmDialog = useBoolean();
  const quickEditForm = useBoolean();
  const [churches, setChurches] = useState([]);
  const capitalize = (text = '') =>
    text
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const showMorePositions = useBoolean();
  const dest = dests.find((d) => d.id === row.destId);
  const church = churches.find(
    (c) => String(c.id) === String(dest?.churchId)
  );
  const getLeadershipRoleLabel = (roleValue) => {
    const role = _allLeadershipRoles.find((r) => r.value === roleValue);
    return role?.label || roleValue;
  };

  // const church = getChurches().find(
  //   (c) => c.id === dest?.churchId
  // );

  const sectionalName = church?.sectionalName || '-';

  const churchName = church?.name || 'Iglesia desconocida';
  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];

  useEffect(() => {
    const load = async () => {
      const data = await getChurches();
      setChurches(Array.isArray(data) ? data : []);
    };

    load();
  }, []);

  const leaderships = leadershipAssignments
    .filter(
      (l) =>
        (l.memberId === row.id ||
          l.memberId === row.memberId ||
          l.member_id === row.id ||
          l.member_id === row.memberId) &&
        (l.status === 'active' || !l.status)
    )
    .map((l) => ({
      ...l,
      label: getLeadershipRoleLabel(l.role),
    }))
    .filter((l) => l.label);

  const renderQuickEditForm = () => (
    <MemberQuickEditForm
      currentMember={row}
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
                id: `${row.memberId}-checkbox`,
                'aria-label': `${row.memberId} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <Avatar alt={row.name} src={row.avatarUrl} />

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <UnderlineLink
                href={editHref}
                color="inherit"
                underline="always"
              >
                {row.name}
              </UnderlineLink>

              <Box component="span" sx={{ color: 'text.disabled' }}>
                {(() => {
                  try {
                    return row.phoneNumber
                      ? parsePhoneNumber(
                        row.phoneNumber.startsWith('+')
                          ? row.phoneNumber
                          : `+1${row.phoneNumber}`
                      )?.formatNational()
                      : '';
                  } catch (e) {
                    return row.phoneNumber;
                  }
                })()}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>

            <Avatar
              alt={capitalize(dest?.name || '')}
              src={dest?.avatarUrl}
              sx={{
                width: 40,
                height: 40,
              }}
            />

            <Stack sx={{ typography: 'body2', alignItems: 'flex-start' }}>
              <UnderlineLink
                href={`/dashboard/level/dest?name=${encodeURIComponent(dest?.name)}`}
                color="inherit"
              >
                {`${capitalize(dest?.name || '')} ${dest?.destNumber || ''}`.trim()}
              </UnderlineLink>

              <Box component="span" sx={{ color: 'text.disabled' }}>
                {`Iglesia ${capitalize(
                  church?.name ||
                  dest?.churchName ||
                  'desconocida'
                )}`}
              </Box>
            </Stack>

          </Box>
        </TableCell>

        <TableCell>
          {leaderships.length ? (
            <Stack>
              <Box
                sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => {
                  const leadership = leaderships[0];
                  if (!leadership) return;

                  let link = '#';

                  if (leadership.level === 'dest') {
                    link = `/dashboard/level/dest?name=${encodeURIComponent(
                      dest?.name
                    )}`;
                  }

                  if (leadership.level === 'sectional') {
                    link = `/dashboard/level/sectional?sectional=${encodeURIComponent(
                      resolveById(SECTIONALS, row.sectionalId)
                    )}`;
                  }

                  if (leadership.level === 'regional') {
                    link = `/dashboard/level/regional?region=${row.regionalId}`;
                  }

                  if (leadership.level === 'national') {
                    link = `/dashboard/level/national`;
                  }

                  window.location.href = link;
                }}
              >
                {leaderships[0].label}
              </Box>
              {!showMorePositions.value && leaderships.length > 1 && (
                <Box
                  sx={{ color: 'text.secondary', fontSize: 12, cursor: 'pointer' }}
                  onClick={showMorePositions.onTrue}
                >
                  +{leaderships.length - 1}
                </Box>
              )}
              {showMorePositions.value &&
                leaderships.slice(1).map((leadership, index) => (
                  <Box key={index} sx={{ fontSize: 13 }}>
                    <Box
                      component="span"
                      sx={{
                        cursor: 'pointer',
                        color: 'text.secondary',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                      onClick={() => {
                        let link = '#';

                        if (leadership.level === 'dest') {
                          link = `/dashboard/level/dest?name=${encodeURIComponent(
                            dest?.name
                          )}`;
                        }

                        if (leadership.level === 'sectional') {
                          link = `/dashboard/level/sectional?sectional=${encodeURIComponent(
                            resolveById(SECTIONALS, row.sectionalId)
                          )}`;
                        }

                        if (leadership.level === 'regional') {
                          link = `/dashboard/level/regional?region=${row.regionalId}`;
                        }

                        if (leadership.level === 'national') {
                          link = `/dashboard/level/national`;
                        }

                        window.location.href = link;
                      }}
                    >
                      {leadership.label}
                    </Box>

                    {index === leaderships.slice(1).length - 1 && (
                      <Box
                        component="span"
                        sx={{
                          ml: 0.5,
                          color: 'text.secondary',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          showMorePositions.onFalse();
                        }}
                      >
                        -{leaderships.length - 1}
                      </Box>
                    )}
                  </Box>
                ))}
            </Stack>
          ) : (
            Array.isArray(row.memberPosition)
              ? row.memberPosition.map(getLeadershipRoleLabel).join(', ')
              : row.memberPosition
                ? getLeadershipRoleLabel(row.memberPosition)
                : 'N/A'
          )}
        </TableCell>

        <TableCell>
          <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
            <UnderlineLink
              href={`/dashboard/level/sectional?sectional=${encodeURIComponent(sectionalName)}`}
              color="inherit"
            >
              {sectionalName}
            </UnderlineLink>
          </Box>
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {row.memberDivision}
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
