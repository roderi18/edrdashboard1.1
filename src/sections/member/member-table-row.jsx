import { useBoolean } from 'minimal-shared/hooks';
import { parsePhoneNumber } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { resolveById } from 'src/utils/resolve-display-name';
import { getStorageCollection } from 'src/utils/storage-service';

import { SECTIONALS } from 'src/_mock/assets';
import { _allLeadershipRoles } from 'src/_mock/_leadership';

import { UnderlineLink } from 'src/components/link/underline-link';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { MemberQuickEditForm } from './member-quick-edit-form';

// ----------------------------------------------------------------------

export function MemberTableRow({
  row,
  selected,
  editHref,
  onSelectRow,
  onDeleteRow,
  canManage = true,
}) {
  const showMorePositions = useBoolean();
  const capitalize = (text = '') =>
    text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  const memberEditId = row.idMiembros ?? row.id ?? row.memberId;
  const destName = row.destName || '';
  const destNumber = row.destNumber || '';
  const destAvatarUrl = row.destAvatarUrl || '';
  const sectionalName = row.sectionalName || '-';
  const churchName = row.churchName || 'Iglesia desconocida';

  const getLeadershipRoleLabel = (roleValue) => {
    const role = _allLeadershipRoles.find((r) => r.value === roleValue);
    return role?.label || roleValue;
  };

  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];
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

  const handleOpenMemberEdit = () => {
    if (!memberEditId) return;
    window.location.href = `/dashboard/level/member/${memberEditId}/edit`;
  };

  const getLeadershipHref = (leadership) => {
    if (leadership.level === 'dest') {
      return `/dashboard/level/dest?name=${encodeURIComponent(destName)}`;
    }

    if (leadership.level === 'sectional') {
      return `/dashboard/level/sectional?sectional=${encodeURIComponent(
        resolveById(SECTIONALS, row.sectionalId)
      )}`;
    }

    if (leadership.level === 'regional') {
      return `/dashboard/level/regional?region=${row.regionalId}`;
    }

    if (leadership.level === 'national') {
      return `/dashboard/level/national`;
    }

    return '#';
  };

  return (
    <TableRow hover selected={selected} aria-checked={selected} tabIndex={-1}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selected}
          disabled={!canManage}
          onClick={canManage ? onSelectRow : undefined}
          slotProps={{
            input: {
              id: `${row.memberId}-checkbox`,
              'aria-label': `${row.memberId} checkbox`,
            },
          }}
        />
      </TableCell>

      <CompactEntityTableCell
        title={row.name}
        href={editHref || `/dashboard/level/member/${memberEditId}/edit`}
        subtitle={(() => {
          try {
            return row.phoneNumber
              ? parsePhoneNumber(
                  row.phoneNumber.startsWith('+') ? row.phoneNumber : `+1${row.phoneNumber}`
                )?.formatNational()
              : '';
          } catch {
            return row.phoneNumber;
          }
        })()}
        avatarUrl={row.avatarUrl}
        onAvatarClick={handleOpenMemberEdit}
        linkUnderline="always"
      />

      <CompactEntityTableCell
        title={`${capitalize(destName)} ${destNumber}`.trim()}
        href={`/dashboard/level/dest?name=${encodeURIComponent(destName)}`}
        subtitle={`Iglesia ${capitalize(churchName)}`}
        avatarAlt={capitalize(destName)}
        avatarUrl={destAvatarUrl}
        avatarSx={{ width: 40, height: 40 }}
      />

      <TableCell>
        {leaderships.length ? (
          <Stack>
            <Box
              sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => {
                window.location.href = getLeadershipHref(leaderships[0]);
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
                      window.location.href = getLeadershipHref(leadership);
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
                      onClick={(event) => {
                        event.stopPropagation();
                        showMorePositions.onFalse();
                      }}
                    >
                      -{leaderships.length - 1}
                    </Box>
                  )}
                </Box>
              ))}
          </Stack>
        ) : Array.isArray(row.memberPosition) ? (
          row.memberPosition.map(getLeadershipRoleLabel).join(', ')
        ) : row.memberPosition ? (
          getLeadershipRoleLabel(row.memberPosition)
        ) : (
          'N/A'
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

      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.memberDivision}</TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        editHref={editHref}
        onDelete={onDeleteRow}
        QuickEditForm={MemberQuickEditForm}
        quickEditProps={{ currentMember: row }}
        deleteContent="¿Seguro que deseas eliminar este miembro?"
      />
    </TableRow>
  );
}
