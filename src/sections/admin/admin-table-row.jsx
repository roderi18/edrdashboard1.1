import { useState } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { getAdminRoleLabel, ROLES_DE_ADMINISTRACION } from 'src/utils/admin-role-label';
import {
  describirRolesOrganizacionales,
  describirUbicacionOrganizacional,
} from 'src/utils/ubicacion-organizacional';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { AdminPermissionsDialog } from './admin-permissions-dialog';
import { AdminRoleAssignmentDialog } from './admin-role-assignment-dialog';

// ----------------------------------------------------------------------

export function AdminTableRow({
  row,
  // Destacamentos, para mostrar el NÚMERO del destacamento en la etiqueta del
  // rol en vez de su id interno. La vista los lee una vez y los pasa por props.
  dests = [],
  // Iglesias, secciones y regiones, leidas una vez por la vista: con ellas se
  // traduce el destacamento de la persona a su seccion y su region.
  catalogos = {},
  selected,
  onSelectRow,
  onAssignAdmin,
  onRemoveAdmin,
  onPermissionsSaved,
  onRoleSaved,
}) {
  const menuActions = usePopover();
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const memberProfileHref =
    row.idMiembros || row.memberId ? `/dashboard/level/member/${row.idMiembros || row.memberId}/edit` : '';

  const isAdminActive =
    Boolean(row.adminId || row.esAdministrador) ||
    ['admin', 'administrador'].includes(String(row.rol || row.role || '').toLowerCase()) ||
    ROLES_DE_ADMINISTRACION.includes(row.rolId || row.roleId || row.role);
  const roleLabel = getAdminRoleLabel(row, { dests });
  const ubicacion = describirUbicacionOrganizacional(row, { dests, ...catalogos });
  const rolesOrganizacionales = describirRolesOrganizacionales(row);
  const codigoDeUsuario = row.memberCode || row.codigoMiembro || row.codigoUsuario || '';

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <MenuItem
          onClick={() => {
            menuActions.onClose();

            if (isAdminActive) {
              onRemoveAdmin?.(row);
            } else {
              onAssignAdmin?.(row);
            }
          }}
        >
          <Iconify icon={isAdminActive ? 'solar:user-minus-bold' : 'solar:user-plus-bold'} />
          {isAdminActive ? 'Quitar administrador' : 'Asignar administrador'}
        </MenuItem>

        <MenuItem
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            setOpenRoleDialog(true);
            menuActions.onClose();
          }}
        >
          <Iconify icon="solar:user-id-bold" />
          Asignar rol
        </MenuItem>

        <MenuItem
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            setOpenPermissionsDialog(true);
            menuActions.onClose();
          }}
        >
          <Iconify icon="solar:shield-keyhole-bold" />
          Administrar permisos
        </MenuItem>

        <MenuItem onClick={menuActions.onClose}>
          <Iconify icon="solar:history-2-bold" />
          Historial de cambios
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <TableRow hover selected={selected} aria-checked={selected} tabIndex={-1}>
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onClick={onSelectRow}
            slotProps={{
              input: {
                id: `${row.id}-checkbox`,
                'aria-label': `${row.name} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell>
          <Box
            component={memberProfileHref ? RouterLink : 'div'}
            href={memberProfileHref || undefined}
            sx={{
              gap: 2,
              display: 'flex',
              alignItems: 'center',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <Avatar alt={row.name} src={row.avatarUrl} />

            <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
              <Link
                component="span"
                color="inherit"
                underline={memberProfileHref ? 'hover' : 'none'}
                sx={{ fontWeight: 500 }}
              >
                {row.name}
              </Link>
              {/* EL CODIGO DE USUARIO, no el correo. Es el identificador con el
                  que se nombra a una persona en toda la organizacion y el que se
                  busca; el correo ocupaba la linea y casi nunca se usaba para
                  reconocer a nadie. */}
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {codigoDeUsuario || '-'}
              </Box>
            </Stack>
          </Box>
        </TableCell>

        <TableCell>
          {ubicacion.region || ubicacion.seccion || ubicacion.destacamento ? (
            <Stack sx={{ typography: 'body2', gap: 0.25 }}>
              {ubicacion.region ? (
                <Box component="span">{ubicacion.region}</Box>
              ) : null}

              {/* La seccion y el destacamento van por debajo y mas apagados: la
                  region encabeza porque es el nivel con el que se ordena la
                  organizacion. */}
              {ubicacion.seccion ? (
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {ubicacion.seccion}
                </Box>
              ) : null}

              {ubicacion.destacamento ? (
                <Box component="span" sx={{ color: 'text.disabled' }}>
                  {ubicacion.destacamento}
                </Box>
              ) : null}
            </Stack>
          ) : (
            '-'
          )}
        </TableCell>

        <TableCell>
          {/* TEXTO LLANO, NO ETIQUETAS. En chips, dos o tres cargos con nombres
              largos —"Coordinador Asistente de Destacamento"— se convertian en
              bloques macizos que pesaban mas que el nombre de la persona, y el
              recuadro no distinguia una cosa de otra: todos los cargos son lo
              mismo. La etiqueta se reserva para lo que si marca una diferencia. */}
          {rolesOrganizacionales.length ? (
            <Stack sx={{ typography: 'body2', gap: 0.25 }}>
              {rolesOrganizacionales.map((cargo) => (
                <Box component="span" key={cargo.codigo} title={cargo.nivel}>
                  {cargo.nombre}
                </Box>
              ))}
            </Stack>
          ) : (
            // Un administrador de plataforma no tiene por que ocupar una casilla
            // en la organizacion: sin cargo no hay nada que ensenar.
            '-'
          )}
        </TableCell>

        <TableCell>{roleLabel}</TableCell>

        <TableCell align="right">
          <IconButton color="default" onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      {renderMenuActions()}

      <AdminPermissionsDialog
        open={openPermissionsDialog}
        admin={row}
        onClose={() => setOpenPermissionsDialog(false)}
        onSaved={(permissions) => onPermissionsSaved?.(row, permissions)}
      />

      <AdminRoleAssignmentDialog
        open={openRoleDialog}
        admin={row}
        onClose={() => setOpenRoleDialog(false)}
        onSaved={(assignment) => onRoleSaved?.(row, assignment)}
      />
    </>
  );
}
