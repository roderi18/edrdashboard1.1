import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

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

export function NationalTableRow({
  row,
  selected,
  editHref,
  onSelectRow,
  onDeleteRow,
  canManage = true,
  canDelete = true,
  // Ambas colecciones las calcula UNA vez la vista y las pasa por props: leerlas
  // aqui suponia dos copias completas por fila y por render. Son exactamente el
  // mismo conjunto con el que la vista construyo las filas.
  allMembers = [],
  leadershipAssignments = [],
}) {
  const assignment = leadershipAssignments.find(
    (l) =>
      l.memberId === row.memberId &&
      ['national', 'regional', 'sectional'].includes(l.level) &&
      l.status === 'active'
  );
  const roleValue = assignment?.role || row.nationalXMemberPosition;
  const roleConfig = _allLeadershipRoles.find((r) => r.value === roleValue);
  const member = allMembers.find((m) => m.id === row.memberId || m.memberId === row.memberId);
  const memberName = member?.fullName || row.nationalXname || 'Desconocido';
  const memberHref = member ? `/dashboard/level/member/${member.id}/edit` : '';
  const phoneNumber = member?.phoneNumber || row.phoneNumber;
  const positionLabel = roleConfig?.label || row.nationalXMemberPositionLabel || '-';
  const structureLabel =
    NATIONAL_STRUCTURES[roleConfig?.structure] || row.nationalEstructureLabel || '-';

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
        title={memberName}
        href={memberHref}
        subtitle={member?.email || row.email || ''}
        avatarAlt={row.nationalXname}
        avatarUrl={row.avatarUrl}
        linkSx={{ cursor: member ? 'pointer' : 'default' }}
      />

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {phoneNumber ? (
          <Link href={getPhoneHref(phoneNumber)} color="inherit" underline="hover">
            {formatPhoneNumber(phoneNumber)}
          </Link>
        ) : (
          formatPhoneNumber(phoneNumber)
        )}
      </TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>{positionLabel}</TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>{structureLabel}</TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete && !row.isLocalhostTest}
        allowQuickEdit={false}
        editHref={editHref}
        onDelete={canDelete ? onDeleteRow : undefined}
        QuickEditForm={NationalQuickEditForm}
        quickEditProps={{ currentNational: row }}
        deleteContent="¿Seguro que deseas eliminar este registro?"
      />
    </TableRow>
  );
}
