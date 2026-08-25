import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { NationalQuickEditForm } from './national-quick-edit-form';

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
  // La vista ya resolvio posicion, ambito y estructura contra el catalogo y
  // Firestore: aqui no se vuelve a deducir nada de los mocks, que era de donde
  // salian etiquetas que no correspondian con la asignacion real.
  const member = allMembers.find(
    (m) => String(m.id) === String(row.memberId) || String(m.memberId) === String(row.memberId)
  );
  const memberName = row.nationalXname || member?.fullName || 'Desconocido';
  const memberHref = member ? `/dashboard/level/member/${member.id}/edit` : '';
  const phoneNumber = member?.phoneNumber || row.phoneNumber;
  const positionLabel = row.nationalXMemberPositionLabel || '-';
  const positionHref = row.nationalXMemberPositionHref || '';
  const structureLabel = row.nationalEstructureLabel || '-';
  const structureScope =
    row.nationalEstructureScope || row.nationalXMemberPositionScope || '';

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

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {/* El cargo lleva a la Directiva de SU entidad. Sin entidad resoluble se
            queda como texto: mejor eso que un enlace a una pagina inexistente. */}
        {positionHref ? (
          <Link
            component={RouterLink}
            href={positionHref}
            underline="always"
            color="inherit"
            sx={{ cursor: 'pointer' }}
          >
            {positionLabel}
          </Link>
        ) : (
          positionLabel
        )}

      </TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {structureLabel}

        {structureScope && (
          <Box component="span" sx={{ display: 'block', color: 'text.secondary', typography: 'caption' }}>
            {structureScope}
          </Box>
        )}
      </TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete}
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
