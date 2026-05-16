import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { SectionalQuickEditForm } from './sectional-quick-edit-form';

// ----------------------------------------------------------------------

export function SectionalTableRow({ row, selected, editHref, onSelectRow, onDeleteRow }) {
  const directorName = row.memberFullName || 'Desconocido';
  const directorAvatarUrl = row.directorAvatarUrl;
  const directorPhoneNumber = row.directorPhoneNumber || '';
  const totalDests = row.sectionalDestCount || 0;
  const totalMembers = row.sectionalXDestMemberCount || 0;
  const directorPhoneLabel = formatPhoneNumber(directorPhoneNumber);
  const regionalName = String(row.regionalName || '').trim();
  const regionalLabel = regionalName || 'Región desconocida';

  return (
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

      <CompactEntityTableCell
        title={row.sectionalName || '-'}
        href={editHref}
        subtitle={row.email}
        avatarUrl={row.avatarUrl}
      />

      <CompactEntityTableCell
        title={row.directorId ? directorName : 'Desconocido'}
        href={row.directorId ? `/dashboard/level/member/${row.directorId}/edit` : ''}
        subtitle={directorPhoneLabel}
        subtitleHref={getPhoneHref(directorPhoneNumber)}
        avatarUrl={directorAvatarUrl}
        linkSx={{ cursor: row.directorId ? 'pointer' : 'default' }}
      />

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Link
            component={RouterLink}
            href={`/dashboard/level/dest?sectional=${encodeURIComponent(row.sectionalName)}`}
            color="inherit"
            underline="always"
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
            underline="always"
          >
            {totalMembers}
          </Link>
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {regionalName ? (
            <Link
              component={RouterLink}
              href={`/dashboard/level/regional?sectional=${encodeURIComponent(regionalName)}`}
              color="inherit"
              underline="always"
            >
              {regionalLabel}
            </Link>
          ) : (
            <Box component="span">{regionalLabel}</Box>
          )}
        </Box>
      </TableCell>

      <CompactEntityRowActions
        editHref={editHref}
        onDelete={onDeleteRow}
        QuickEditForm={SectionalQuickEditForm}
        quickEditProps={{ currentSectional: row }}
        deleteContent="¿Seguro que deseas eliminar esta sección?"
      />
    </TableRow>
  );
}
