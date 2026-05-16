import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { RegionalQuickEditForm } from './regional-quick-edit-form';

// ----------------------------------------------------------------------

export function RegionalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const directorAssignment = LEADERSHIP_ASSIGNMENTS.find(
    (l) =>
      l.level === 'regional' &&
      l.entityId === row.id &&
      l.role === 'director_regional' &&
      l.status === 'active'
  );

  const directorId = row.directorId || directorAssignment?.memberId;
  const directorName = row.memberFullName || 'Director desconocido';
  const directorAvatarUrl = row.directorAvatarUrl;
  const directorPhoneNumber = row.directorPhoneNumber || '';
  const directorPhoneLabel = formatPhoneNumber(directorPhoneNumber);

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
        title={row.regionalName}
        href={editHref}
        subtitle={row.email}
        avatarUrl={row.avatarUrl}
        avatarChildren={!row.avatarUrl && row.regionalName?.[0]}
      />

      <CompactEntityTableCell
        title={directorName}
        href={directorId ? `/dashboard/level/member/${directorId}/edit` : ''}
        subtitle={directorPhoneLabel}
        subtitleHref={getPhoneHref(directorPhoneNumber)}
        avatarUrl={directorAvatarUrl}
        avatarChildren={!directorAvatarUrl && directorName?.[0]}
        linkSx={{ cursor: directorId ? 'pointer' : 'default' }}
      />

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Link
            component={RouterLink}
            href={`/dashboard/level/sectional?region=${encodeURIComponent(row.regionalName)}`}
            color="inherit"
            underline="always"
          >
            {row.regionalXSectionalCount}
          </Link>
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Link
            component={RouterLink}
            href={`/dashboard/level/dest?region=${row.id}`}
            color="inherit"
            underline="always"
          >
            {row.regionalXSectionalXDestCount}
          </Link>
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Link
            component={RouterLink}
            href={`/dashboard/level/member?region=${row.id}`}
            color="inherit"
            underline="always"
          >
            {row.regionalXSectionalMemberCount}
          </Link>
        </Box>
      </TableCell>

      <CompactEntityRowActions
        editHref={editHref}
        onDelete={onDeleteRow}
        QuickEditForm={RegionalQuickEditForm}
        quickEditProps={{ currentRegional: row }}
        deleteContent="¿Seguro que deseas eliminar esta regional?"
      />
    </TableRow>
  );
}
