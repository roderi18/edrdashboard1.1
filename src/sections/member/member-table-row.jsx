import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';

import { useRouter } from 'src/routes/hooks';

import { isUnknownLabel } from 'src/utils/is-unknown-label';
import { resolveById } from 'src/utils/resolve-display-name';
import { capitalizeWords, formatChurchName } from 'src/utils/text-format';
import { getPhoneHref, formatPhoneNumber } from 'src/utils/format-phone-number';

import { SECTIONALS } from 'src/_mock/assets';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';

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
  canDelete = true,
  allowQuickEdit = true,
  // La coleccion se lee UNA sola vez en la vista y se pasa por props: leerla aqui
  // suponia una copia completa por fila y por render (N lecturas por render).
  leadershipAssignments = [],
}) {
  const router = useRouter();
  const showMorePositions = useBoolean();
  const memberEditId = row.memberId ?? row.codigoMiembro ?? row.idMiembros ?? row.id;
  const destName = row.destName || '';
  const destNumber = row.destNumber || '';
  const destAvatarUrl = row.destAvatarUrl || '';
  const sectionalName = String(row.sectionalName || '').trim() || 'Sección desconocida';
  const churchName = row.churchName || 'Iglesia desconocida';
  const memberDivisionLabel = String(row.memberDivision || '').trim() || 'División desconocida';

  const getLeadershipRoleLabel = (roleValue) => {
    if (Array.isArray(roleValue)) {
      const roles = roleValue.filter(Boolean);

      return roles.length
        ? roles.map((roleItem) => getLeadershipRoleLabel(roleItem)).join(', ')
        : 'Posición desconocida';
    }

    const normalizedRole = String(roleValue || '').trim();

    if (!normalizedRole) return 'Posición desconocida';

    // Se traduce contra el CATALOGO real. Antes se buscaba en los roles de
    // ejemplo, que no contienen los ids del catalogo, asi que caia siempre en el
    // valor crudo ("seccional-coordinador-produccion").
    const role = DIRECTIVA_POSITIONS.find((p) => p.idCargo === normalizedRole);
    return role?.nombreCargo || normalizedRole;
  };

  const memberPositionLabel = (() => {
    if (row.destLeadershipPosition || row.directivaLeadershipPosition) {
      return row.destLeadershipPosition || row.directivaLeadershipPosition;
    }

    if (Array.isArray(row.memberPosition)) {
      const positions = row.memberPosition.filter(Boolean);

      return positions.length
        ? positions.map(getLeadershipRoleLabel).join(', ')
        : 'Posición desconocida';
    }

    return String(row.memberPosition || '').trim()
      ? getLeadershipRoleLabel(row.memberPosition)
      : 'Posición desconocida';
  })();

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
  const hasDirectLeadershipPosition = Boolean(
    row.destLeadershipPosition || row.directivaLeadershipPosition
  );
  const isPositionUnknown =
    !hasDirectLeadershipPosition && !leaderships.length && isUnknownLabel(memberPositionLabel);

  const handleOpenMemberEdit = () => {
    if (!memberEditId) return;
    router.push(`/dashboard/level/member/${memberEditId}/edit`);
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
    <TableRow
      hover
      selected={selected}
      aria-checked={selected}
      tabIndex={-1}
    >
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
            return formatPhoneNumber(row.phoneNumber);
          } catch {
            return row.phoneNumber;
          }
        })()}
        subtitleHref={getPhoneHref(row.phoneNumber)}
        avatarUrl={row.avatarUrl}
        onAvatarClick={handleOpenMemberEdit}
        linkUnderline="always"
      />

      <CompactEntityTableCell
        title={`${capitalizeWords(destName)} ${destNumber}`.trim()}
        href={`/dashboard/level/dest?name=${encodeURIComponent(destName)}`}
        subtitle={formatChurchName(churchName)}
        avatarAlt={capitalizeWords(destName)}
        avatarUrl={destAvatarUrl}
        avatarSx={{ width: 40, height: 40 }}
      />

      <TableCell
        sx={{
          typography: 'body2',
          fontWeight: 400,
          ...(isPositionUnknown && { color: 'text.disabled' }),
        }}
      >
        {row.destLeadershipPosition || row.directivaLeadershipPosition ? (
          <Stack spacing={0.25}>
            {row.destLeadershipPosition ? (
              <Box
                sx={{
                  typography: 'body2',
                  fontWeight: 400,
                  ...(isUnknownLabel(row.destLeadershipPosition) && { color: 'text.disabled' }),
                }}
              >
                {row.destLeadershipPosition}
              </Box>
            ) : null}

            {row.directivaLeadershipPosition ? (
              <Box
                sx={{
                  typography: 'caption',
                  color: isUnknownLabel(row.directivaLeadershipPosition)
                    ? 'text.disabled'
                    : 'text.secondary',
                }}
              >
                {row.directivaLeadershipPosition}
              </Box>
            ) : null}
          </Stack>
        ) : leaderships.length ? (
          <Stack>
            <UnderlineLink
              href={getLeadershipHref(leaderships[0])}
              color="inherit"
              sx={{ fontWeight: 400 }}
            >
              {leaderships[0].label}
            </UnderlineLink>

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
                  <UnderlineLink
                    href={getLeadershipHref(leadership)}
                    color="inherit"
                    sx={{ color: 'text.secondary' }}
                  >
                    {leadership.label}
                  </UnderlineLink>

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
        ) : Array.isArray(row.memberPosition) && row.memberPosition.length ? (
          row.memberPosition.map(getLeadershipRoleLabel).join(', ')
        ) : row.memberPosition ? (
          memberPositionLabel
        ) : (
          'Posición desconocida'
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

      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          ...(isUnknownLabel(memberDivisionLabel) && { color: 'text.disabled' }),
        }}
      >
        {memberDivisionLabel}
      </TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete}
        allowQuickEdit={allowQuickEdit}
        editHref={editHref}
        onDelete={canDelete ? onDeleteRow : undefined}
        QuickEditForm={MemberQuickEditForm}
        quickEditProps={{ currentMember: row }}
        deleteContent="¿Seguro que deseas eliminar este miembro?"
      />
    </TableRow>
  );
}
