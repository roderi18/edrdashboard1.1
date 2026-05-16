import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { getStorageCollection } from 'src/utils/storage-service';
import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { MEMBERS } from 'src/_mock/assets';
import { _allLeadershipRoles } from 'src/_mock/_leadership';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { NationalQuickEditForm } from './national-quick-edit-form';

// ----------------------------------------------------------------------

const NATIONAL_STRUCTURES = {
  ministerios_infantiles: 'Ministerios Infantiles',
  consejo_ejecutivo: 'Consejo Ejecutivo',
  oficiales_especiales_nacionales: 'Oficiales Especiales Nacionales',
  directivas_regionales: 'Directivas Regionales',
  directivas_seccionales: 'Directivas Seccionales',
  directivas_zonales: 'Directivas Zonales',
};

// ----------------------------------------------------------------------

export function NationalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const leadershipAssignments = getStorageCollection('leadershipAssignments') || [];
  const storedMembers = getStorageCollection('members') || [];
  const allMembers = [...MEMBERS, ...storedMembers];

  const assignment = leadershipAssignments.find(
    (l) =>
      l.memberId === row.memberId &&
      ['national', 'regional', 'sectional'].includes(l.level) &&
      l.status === 'active'
  );
  const roleValue = assignment?.role || row.nationalXMemberPosition;
  const roleConfig = _allLeadershipRoles.find((r) => r.value === roleValue);
  const member = allMembers.find((m) => m.id === row.memberId || m.memberId === row.memberId);
  const structureLabel = NATIONAL_STRUCTURES[roleConfig?.structure] || '-';

  return (
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

      <CompactEntityTableCell
        title={member?.fullName || row.nationalXname || 'Desconocido'}
        href={member ? `/dashboard/level/member/${member.id}/edit` : ''}
        subtitle={member?.email || row.email || ''}
        avatarAlt={row.nationalXname}
        avatarUrl={row.avatarUrl}
        linkSx={{ cursor: member ? 'pointer' : 'default' }}
      />

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {member?.phoneNumber ? (
          <Link href={getPhoneHref(member.phoneNumber)} color="inherit" underline="hover">
            {formatPhoneNumber(member.phoneNumber)}
          </Link>
        ) : (
          formatPhoneNumber(member?.phoneNumber)
        )}
      </TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {roleConfig?.label || row.nationalXMemberPositionLabel || '-'}
      </TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>{structureLabel}</TableCell>

      <CompactEntityRowActions
        editHref={editHref}
        onDelete={onDeleteRow}
        QuickEditForm={NationalQuickEditForm}
        quickEditProps={{ currentNational: row }}
        deleteContent="¿Seguro que deseas eliminar este registro?"
      />
    </TableRow>
  );
}
