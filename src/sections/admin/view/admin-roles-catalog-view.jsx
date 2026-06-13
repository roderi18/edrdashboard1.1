'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';
import {
  ROLES_CATALOGO,
  ROLES_POR_CODIGO,
  crearDefinicionRol,
  obtenerRolesAutorizacion,
  sincronizarCatalogoAutorizacion,
} from 'src/auth/permissions';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'rol', label: 'Rol', width: 280 },
  { id: 'alcance', label: 'Alcance', width: 160 },
  { id: 'permisos', label: 'Permisos' },
  { id: 'restricciones', label: 'Restricciones', width: 260 },
  { id: 'estado', label: 'Estado', width: 120 },
];

const LOCAL_ROLES = ROLES_CATALOGO.map(crearDefinicionRol);

const formatValue = (value = '') =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());

const getRoleName = (role) => role.nombre || ROLES_POR_CODIGO[role.codigo]?.nombre || role.codigo;

const getRestrictionLabels = (restrictions = {}) =>
  [
    restrictions.soloLectura && 'Solo lectura',
    restrictions.requierePermisoParaMenores && 'Menores requieren permiso',
    restrictions.eliminarDocumentosRequiereAprobacion && 'Eliminar documentos requiere aprobacion',
    restrictions.puedeAsignarNumeroOficial && 'Puede asignar numero oficial',
    restrictions.accesoAdministrativoTienda && 'Acceso administrativo a tienda',
  ].filter(Boolean);

export function AdminRolesCatalogView() {
  const { user } = useAuthContext();
  const [roles, setRoles] = useState(LOCAL_ROLES);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);

    try {
      const result = await obtenerRolesAutorizacion();
      setRoles(result.length ? result : LOCAL_ROLES);
    } catch (error) {
      console.error(error);
      setRoles(LOCAL_ROLES);
      toast.warning('Mostrando catalogo local de roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleSync = async () => {
    setSyncing(true);

    try {
      const result = await sincronizarCatalogoAutorizacion({ usuario: user });
      toast.success(`${result.roles} roles sincronizados.`);
      await loadRoles();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo sincronizar roles.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        <SummaryCard
          title="Roles base"
          value={roles.length}
          caption="Plantillas disponibles"
          icon="solar:users-group-rounded-bold"
        />
        <SummaryCard
          title="Asignables"
          value={roles.filter((role) => role.asignableDesdeAdministradores).length}
          caption="Disponibles para usuarios"
          icon="solar:user-plus-bold"
        />
        <SummaryCard
          title="Fuente"
          value={loading ? 'Cargando' : 'Firebase'}
          caption="Con respaldo local"
          icon="solar:database-bold"
        />
      </Box>

      <Card>
        <CardHeader
          title="Roles base"
          subheader="Cada rol agrupa permisos y restricciones. Luego se asigna a un usuario junto a su alcance organizacional."
          action={
            <Button
              color="inherit"
              variant="outlined"
              loading={syncing}
              startIcon={<Iconify icon="solar:refresh-bold" />}
              onClick={handleSync}
            >
              Sincronizar Firebase
            </Button>
          }
        />

        <TableContainer sx={{ mt: 2 }}>
          <Scrollbar>
            <Table sx={{ minWidth: 1100 }}>
              <TableHeadCustom headCells={TABLE_HEAD} />
              <TableBody>
                {roles.map((role) => {
                  const restrictions = getRestrictionLabels(role.restricciones);

                  return (
                    <TableRow key={role.codigo} hover>
                      <TableCell>
                        <Typography variant="subtitle2">{getRoleName(role)}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {role.descripcion}
                        </Typography>
                        <Typography
                          variant="caption"
                          component="div"
                          sx={{ mt: 0.5, color: 'text.disabled', fontFamily: 'monospace' }}
                        >
                          {role.codigo}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Label color="info">{formatValue(role.alcancePredeterminado)}</Label>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                          {(role.permisos || []).map((permission) => (
                            <Chip key={permission} size="small" variant="soft" label={permission} />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.75} alignItems="flex-start">
                          {restrictions.length ? (
                            restrictions.map((restriction) => (
                              <Chip key={restriction} size="small" label={restriction} />
                            ))
                          ) : (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              Sin restricciones especiales
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Label color={role.activo === false ? 'default' : 'success'}>
                          {role.activo === false ? 'Inactivo' : 'Activo'}
                        </Label>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>
    </Stack>
  );
}

function SummaryCard({ title, value, caption, icon }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'primary.lighter',
          }}
        >
          <Iconify icon={icon} width={24} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
          <Typography variant="h6" noWrap>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
            {caption}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}
