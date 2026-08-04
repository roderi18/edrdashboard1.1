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

export function SectionalTableRow({
  row,
  selected,
  editHref,
  onSelectRow,
  onDeleteRow,
  canManage = true,
  canDelete = true,
  disabled = false,
  lockMemberCount = false,
}) {
  const directorName = row.memberFullName || 'Desconocido';
  const directorAvatarUrl = row.directorAvatarUrl;
  const directorPhoneNumber = row.directorPhoneNumber || '';
  const totalDests = row.sectionalDestCount || 0;
  const totalMembers = row.sectionalXDestMemberCount || 0;
  const directorPhoneLabel = formatPhoneNumber(directorPhoneNumber);
  const regionalName = String(row.regionalName || '').trim();
  const regionalLabel = regionalName || 'Región desconocida';

  // Cuando la seccion no es la propia del usuario (cargos con visibilidad de
  // toda la region), se muestra en modo consulta: sin enlaces y con el texto
  // atenuado en todas las celdas.
  const renderCount = (value, href) =>
    disabled ? (
      <Box component="span" sx={{ color: 'text.disabled' }}>
        {value}
      </Box>
    ) : (
      <Link component={RouterLink} href={href} color="inherit" underline="always">
        {value}
      </Link>
    );

  return (
    <TableRow selected={selected}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selected}
          disabled={disabled}
          onChange={onSelectRow}
          slotProps={{
            input: { id: `checkbox-${row.id}` },
          }}
        />
      </TableCell>

      <CompactEntityTableCell
        title={row.sectionalName || '-'}
        href={disabled ? '' : editHref}
        subtitle={row.email}
        avatarUrl={row.avatarUrl}
        linkSx={disabled ? { color: 'text.disabled' } : undefined}
      />

      <CompactEntityTableCell
        title={row.directorId ? directorName : 'Desconocido'}
        href={disabled || !row.directorId ? '' : `/dashboard/level/member/${row.directorId}/edit`}
        subtitle={directorPhoneLabel}
        subtitleHref={disabled ? undefined : getPhoneHref(directorPhoneNumber)}
        avatarUrl={directorAvatarUrl}
        linkSx={
          disabled ? { color: 'text.disabled' } : { cursor: row.directorId ? 'pointer' : 'default' }
        }
      />

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {renderCount(totalDests, `/dashboard/level/dest?sectional=${encodeURIComponent(row.id)}`)}
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {disabled || lockMemberCount ? (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              {totalMembers}
            </Box>
          ) : (
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?sectional=${row.id}`}
              color="inherit"
              underline="always"
            >
              {totalMembers}
            </Link>
          )}
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {regionalName && !disabled ? (
            <Link
              component={RouterLink}
              href={`/dashboard/level/regional?sectional=${encodeURIComponent(regionalName)}`}
              color="inherit"
              underline="always"
            >
              {regionalLabel}
            </Link>
          ) : (
            <Box component="span" sx={disabled ? { color: 'text.disabled' } : undefined}>
              {regionalLabel}
            </Box>
          )}
        </Box>
      </TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete}
        allowQuickEdit={false}
        editHref={editHref}
        onDelete={canDelete ? onDeleteRow : undefined}
        QuickEditForm={SectionalQuickEditForm}
        quickEditProps={{ currentSectional: row }}
        deleteContent="¿Seguro que deseas eliminar esta sección?"
      />
    </TableRow>
  );
}
