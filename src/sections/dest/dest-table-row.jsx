import { parsePhoneNumber } from 'libphonenumber-js';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { DestQuickEditForm } from './dest-quick-edit-form';

// ----------------------------------------------------------------------

export function DestTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const capitalize = (text) =>
    (text || '').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  const id = row.id || row.idDestacamento;
  const sectionalName = row.sectionalName || '';
  const regionalName = row.regionalName || '-';
  const coordinatorName = row.memberFullName || 'Desconocido';
  const coordinatorId = row.coordinatorId;
  const coordinatorAvatarUrl = row.coordinatorAvatarUrl;
  const coordinatorPhoneNumber = row.coordinatorPhoneNumber || '';
  const destMemberCount = row.destMemberCount || 0;
  const churchName = row?.churchName || 'Iglesia desconocida';
  const coordinatorPhoneLabel = coordinatorPhoneNumber
    ? (() => {
        try {
          return parsePhoneNumber(
            coordinatorPhoneNumber.startsWith('+')
              ? coordinatorPhoneNumber
              : `+1${coordinatorPhoneNumber}`
          )?.formatNational();
        } catch {
          return coordinatorPhoneNumber || '';
        }
      })()
    : '';

  return (
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

      <CompactEntityTableCell
        title={`${capitalize(row.nombre)} ${row.numero || ''}`}
        href={`/dashboard/level/dest/${id}/edit`}
        subtitle={`Iglesia ${capitalize(churchName)}`}
        avatarAlt={row.nombre}
        avatarUrl={row.avatarUrl}
      />

      <CompactEntityTableCell
        title={capitalize(coordinatorName)}
        href={coordinatorId ? `/dashboard/level/member/${coordinatorId}/edit` : ''}
        subtitle={coordinatorPhoneLabel}
        avatarUrl={coordinatorAvatarUrl}
        avatarSx={{ width: 40, height: 40 }}
        linkSx={{ cursor: coordinatorId ? 'pointer' : 'default' }}
      />

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Link component={RouterLink} href={`/dashboard/level/member?dest=${id}`} color="inherit">
            {destMemberCount}
          </Link>
        </Box>
      </TableCell>

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
            href={`/dashboard/level/regional?region=${row.regionalId || ''}`}
            color="inherit"
          >
            {regionalName}
          </Link>
        </Box>
      </TableCell>

      <CompactEntityRowActions
        editHref={editHref || `/dashboard/level/dest/${id}/edit`}
        onDelete={onDeleteRow}
        QuickEditForm={DestQuickEditForm}
        quickEditProps={{ currentDest: row }}
        deleteContent="¿Seguro que deseas eliminar este destacamento?"
      />
    </TableRow>
  );
}
