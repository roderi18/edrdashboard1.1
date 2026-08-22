import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { capitalizeWords, formatChurchName } from 'src/utils/text-format';
import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { CompactEntityTableCell } from 'src/sections/common/compact-entity-table-cell';
import { CompactEntityRowActions } from 'src/sections/common/compact-entity-row-actions';

import { DestQuickEditForm } from './dest-quick-edit-form';

// ----------------------------------------------------------------------

export function DestTableRow({
  row,
  selected,
  editHref,
  onSelectRow,
  onDeleteRow,
  canManage = true,
  canDelete = true,
  lockMemberCount = false,
  ocultarMemberCount = false,
}) {
  const id = row.id || row.idDestacamento;
  const sectionalName = String(row.sectionalName || '').trim();
  const sectionalLabel = sectionalName || 'Sección desconocida';
  const regionalName = row.regionalName || '-';
  const coordinatorName = row.memberFullName || 'Coordinador desconocido';
  const coordinatorLabel =
    coordinatorName === 'Coordinador desconocido' ? coordinatorName : capitalizeWords(coordinatorName);
  const coordinatorId = row.coordinatorId;
  const coordinatorAvatarUrl = row.coordinatorAvatarUrl;
  const coordinatorPhoneNumber = row.coordinatorPhoneNumber || '';
  const destMemberCount = row.destMemberCount || 0;
  const churchName = row?.churchName || '';
  const coordinatorPhoneLabel = formatPhoneNumber(coordinatorPhoneNumber);

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
        title={`${capitalizeWords(row.nombre)} ${row.numero || ''}`}
        href={`/dashboard/level/dest/${id}/edit`}
        subtitle={formatChurchName(churchName)}
        avatarAlt={row.nombre}
        avatarUrl={row.avatarUrl}
      />

      <CompactEntityTableCell
        title={coordinatorLabel}
        href={coordinatorId ? `/dashboard/level/member/${coordinatorId}/edit` : ''}
        subtitle={coordinatorPhoneLabel}
        subtitleHref={getPhoneHref(coordinatorPhoneNumber)}
        avatarUrl={coordinatorAvatarUrl}
        avatarSx={{ width: 40, height: 40 }}
        linkSx={{ cursor: coordinatorId ? 'pointer' : 'default' }}
      />

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {ocultarMemberCount ? (
            // Cuantos miembros tiene otro destacamento tampoco es asunto de un
            // cargo de destacamento: se oculta el numero, no solo el enlace.
            <Tooltip title="Solo se ve la cantidad de tu propio destacamento" placement="top" arrow>
              <Box component="span" sx={{ color: 'text.disabled', letterSpacing: 2 }}>
                ••
              </Box>
            </Tooltip>
          ) : lockMemberCount ? (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              {destMemberCount}
            </Box>
          ) : (
            <Link
              component={RouterLink}
              href={`/dashboard/level/member?dest=${id}`}
              color="inherit"
              underline="always"
            >
              {destMemberCount}
            </Link>
          )}
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          {sectionalName ? (
            <Link
              component={RouterLink}
              href={`/dashboard/level/sectional?section=${encodeURIComponent(sectionalName)}`}
              color="inherit"
              underline="always"
            >
              {sectionalLabel}
            </Link>
          ) : (
            <Box component="span">{sectionalLabel}</Box>
          )}
        </Box>
      </TableCell>

      <TableCell>
        <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
          <Link
            component={RouterLink}
            href={`/dashboard/level/regional?region=${row.regionalId || ''}`}
            color="inherit"
            underline="always"
          >
            {regionalName}
          </Link>
        </Box>
      </TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete}
        allowQuickEdit={false}
        editHref={editHref || `/dashboard/level/dest/${id}/edit`}
        onDelete={canDelete ? onDeleteRow : undefined}
        QuickEditForm={DestQuickEditForm}
        quickEditProps={{ currentDest: row }}
        deleteContent="¿Seguro que deseas eliminar este destacamento?"
      />
    </TableRow>
  );
}
