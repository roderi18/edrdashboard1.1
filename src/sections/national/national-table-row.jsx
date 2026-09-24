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
  onEditRow,
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
  const memberHref = row.integrante?.id
    ? `/dashboard/level/member/${encodeURIComponent(row.integrante.id)}/edit?cuatrienio=${encodeURIComponent(row.integrante.cuatrienio || '')}&integrante=${encodeURIComponent(row.integrante.id)}`
    : member || row.memberId
      ? // Con el id de la asignación basta: sin él, si el padrón (API .NET) no
        // cargaba, el nombre quedaba sin enlace a la ficha.
        `/dashboard/level/member/${encodeURIComponent(member?.id ?? row.memberId)}/edit?origen=consejo-nacional`
      : '';
  const phoneNumber = member?.phoneNumber || row.phoneNumber;
  // EN LA MEMORIA DE UN CUATRIENIO NO SE ENSEÑA EL TELEFONO.
  //
  // La fila pinta el nombre y la foto CONGELADOS de entonces, pero el telefono
  // se saca del padron de HOY: era un dato de ahora colado en una instantanea
  // de antes. Se quita con `undefined`, que es lo unico que la celda omite; con
  // cadena vacia saldria el "Tel. desconocido" de formatPhoneNumber.
  const esMemoriaDeCuatrienio = Boolean(row.integrante);
  const positionLabel = row.nationalXMemberPositionLabel || '-';
  const positionHref = row.nationalXMemberPositionHref || '';
  const organizationalLevel = row.nationalOrganizationalLevel || '-';
  const structureLabel = row.nationalEstructureLabel || '-';

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
        subtitle={esMemoriaDeCuatrienio ? undefined : formatPhoneNumber(phoneNumber)}
        subtitleHref={esMemoriaDeCuatrienio ? undefined : getPhoneHref(phoneNumber)}
        avatarAlt={row.nationalXname}
        avatarUrl={row.avatarUrl}
        linkSx={{ cursor: memberHref ? 'pointer' : 'default' }}
      />

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {/* El cargo lleva a la Directiva de SU entidad. Sin entidad resoluble se
            queda como texto: mejor eso que un enlace a una pagina inexistente. */}
        {/* En un cuatrienio pasado el cargo abre el organigrama DE ENTONCES, que
            no es una pagina sino un dialogo. */}
        {row.onAbrirPosicion ? (
          <Link
            component="button"
            type="button"
            onClick={row.onAbrirPosicion}
            underline="always"
            color="inherit"
            sx={{ font: 'inherit', verticalAlign: 'baseline' }}
          >
            {positionLabel}
          </Link>
        ) : positionHref ? (
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

      <TableCell sx={{ whiteSpace: 'nowrap' }}>{organizationalLevel}</TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {structureLabel}
      </TableCell>

      <CompactEntityRowActions
        canManage={canManage}
        allowDelete={canDelete}
        allowQuickEdit={false}
        editHref={editHref}
        onEdit={onEditRow}
        onDelete={canDelete ? onDeleteRow : undefined}
        QuickEditForm={NationalQuickEditForm}
        quickEditProps={{ currentNational: row }}
        deleteContent="¿Seguro que deseas eliminar este registro?"
      />
    </TableRow>
  );
}
