import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { RegionalQuickEditForm } from './regional-quick-edit-form';

// ----------------------------------------------------------------------

export function RegionalTableRow({
  row,
  selected,
  editHref,
  onSelectRow,
  onDeleteRow,
  canManage = true,
  canDelete = true,
  disabledCounts = false,
  disabledDestCount,
  lockMemberCount = false,
}) {
  // Los destacamentos pueden estar bloqueados aparte de las secciones (p. ej. los
  // cargos seccionales solo entran a los de su propia region). Si no se especifica,
  // sigue el mismo estado que el resto de los contadores de estructura.
  const destCountDisabled = disabledDestCount ?? disabledCounts;
  // El director sale de la propia region. Habia aqui una busqueda de respaldo
  // contra `LEADERSHIP_ASSIGNMENTS` (datos de ejemplo) que no podia acertar: sus
  // entidades son 'reg-este' y sus miembros 'member-01', mientras los reales son
  // numeros.
  const directorId = row.directorId;
  const directorName = row.memberFullName || 'Director desconocido';
  const directorAvatarUrl = row.directorAvatarUrl;
  const directorPhoneNumber = row.directorPhoneNumber || '';
  const directorPhoneLabel = formatPhoneNumber(directorPhoneNumber);

  // Para cargos con visibilidad de solo lectura (p. ej. Lider de Grupo) los
  // contadores de secciones/destacamentos/miembros se muestran atenuados y sin
  // enlace.
  const renderCount = (value, href, disabled = disabledCounts) =>
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
          {renderCount(
            row.regionalXSectionalCount,
            `/dashboard/level/sectional?region=${encodeURIComponent(row.regionalName)}`
          )}
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {renderCount(
            row.regionalXSectionalXDestCount,
            `/dashboard/level/dest?region=${row.id}`,
            destCountDisabled
          )}
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {lockMemberCount ? (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              {row.regionalXSectionalMemberCount}
            </Box>
          ) : (
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?region=${row.id}`}
              color="inherit"
              underline="always"
            >
              {row.regionalXSectionalMemberCount}
            </Link>
          )}
        </Box>
      </TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete}
        allowQuickEdit={false}
        editHref={editHref}
        onDelete={canDelete ? onDeleteRow : undefined}
        QuickEditForm={RegionalQuickEditForm}
        quickEditProps={{ currentRegional: row }}
        deleteContent="¿Seguro que deseas eliminar esta regional?"
      />
    </TableRow>
  );
}
