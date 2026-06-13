'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

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
  PERMISOS_CATALOGO,
  obtenerCatalogoPermisos,
  sincronizarCatalogoAutorizacion,
} from 'src/auth/permissions';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'nombre', label: 'Permiso' },
  { id: 'codigo', label: 'Codigo', width: 260 },
  { id: 'accion', label: 'Accion', width: 180 },
  { id: 'estado', label: 'Estado', width: 120 },
];

const groupByModule = (items = []) =>
  items.reduce((acc, item) => {
    const moduleKey = item.modulo || 'general';
    acc[moduleKey] = [...(acc[moduleKey] || []), item];
    return acc;
  }, {});

const formatModule = (value = '') =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());

export function AdminPermissionsCatalogContent({ showSummary = true, showSync = true }) {
  const { user } = useAuthContext();
  const [permissions, setPermissions] = useState(PERMISOS_CATALOGO);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadPermissions = useCallback(async () => {
    setLoading(true);

    try {
      const result = await obtenerCatalogoPermisos();
      setPermissions(result.length ? result : PERMISOS_CATALOGO);
    } catch (error) {
      console.error(error);
      setPermissions(PERMISOS_CATALOGO);
      toast.warning('Mostrando catalogo local de permisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const groupedPermissions = useMemo(() => groupByModule(permissions), [permissions]);
  const modules = Object.keys(groupedPermissions).sort((a, b) => a.localeCompare(b));

  const handleSync = async () => {
    setSyncing(true);

    try {
      const result = await sincronizarCatalogoAutorizacion({ usuario: user });
      toast.success(`${result.permisos} permisos y ${result.roles} roles sincronizados.`);
      await loadPermissions();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo sincronizar el catalogo.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Stack spacing={3}>
      {showSummary && (
        <Box
          sx={{
            gap: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          }}
        >
          <SummaryCard
            title="Permisos"
            value={permissions.length}
            caption="Acciones disponibles"
            icon="solar:shield-check-bold"
          />
          <SummaryCard
            title="Modulos"
            value={modules.length}
            caption="Agrupados por area"
            icon="solar:widget-5-bold"
          />
          <SummaryCard
            title="Fuente"
            value={loading ? 'Cargando' : 'Firebase'}
            caption="Con respaldo local"
            icon="solar:database-bold"
          />
        </Box>
      )}

      <Card>
        <CardHeader
          title="Catalogo de permisos"
          subheader="Permisos base que luego se asignan a roles. La edicion diaria debe hacerse sobre roles, no sobre esta lista."
          action={
            showSync ? (
              <Button
                color="inherit"
                variant="outlined"
                loading={syncing}
                startIcon={<Iconify icon="solar:refresh-bold" />}
                onClick={handleSync}
              >
                Sincronizar Firebase
              </Button>
            ) : null
          }
        />

        <Stack spacing={3} sx={{ p: 3 }}>
          {modules.map((moduleKey) => (
            <Box key={moduleKey}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1">{formatModule(moduleKey)}</Typography>
                <Chip size="small" label={groupedPermissions[moduleKey].length} />
              </Stack>

              <TableContainer>
                <Scrollbar>
                  <Table size="small" sx={{ minWidth: 820 }}>
                    <TableHeadCustom headCells={TABLE_HEAD} />
                    <TableBody>
                      {groupedPermissions[moduleKey].map((permission) => (
                        <TableRow key={permission.codigo} hover>
                          <TableCell>
                            <Typography variant="subtitle2">{permission.nombre}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {permission.descripcion}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {permission.codigo}
                            </Typography>
                          </TableCell>
                          <TableCell>{permission.accion}</TableCell>
                          <TableCell>
                            <Label color={permission.activo === false ? 'default' : 'success'}>
                              {permission.activo === false ? 'Inactivo' : 'Activo'}
                            </Label>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Scrollbar>
              </TableContainer>
            </Box>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

export function AdminPermissionsCatalogView() {
  return <AdminPermissionsCatalogContent />;
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
