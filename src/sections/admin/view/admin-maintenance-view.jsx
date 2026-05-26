'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';

import {
  descargarLogsAdmin,
  exportarRespaldoAdmin,
  obtenerUltimoRespaldoAdmin,
  inspeccionarColeccionesAdmin,
} from 'src/services/admin-maintenance-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'collection', label: 'Colección' },
  { id: 'count', label: 'Registros', width: 120 },
  { id: 'status', label: 'Estado', width: 150 },
  { id: 'detail', label: 'Detalle' },
];

const STATUS_COLORS = {
  correcta: 'success',
  vacia: 'warning',
  inconsistente: 'error',
};

export function AdminMaintenanceView() {
  const { user } = useAuthContext();
  const [lastBackup, setLastBackup] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingLogs, setDownloadingLogs] = useState(false);

  const loadMaintenance = useCallback(async () => {
    setLoading(true);

    try {
      const [backup, inspection] = await Promise.all([
        obtenerUltimoRespaldoAdmin(),
        inspeccionarColeccionesAdmin(),
      ]);

      setLastBackup(backup);
      setCollections(inspection);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo cargar mantenimiento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaintenance();
  }, [loadMaintenance]);

  const handleExportBackup = async () => {
    setExporting(true);

    try {
      const backup = await exportarRespaldoAdmin({ usuario: user });
      setLastBackup(backup);
      toast.success('Respaldo exportado correctamente.');
      loadMaintenance();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo exportar el respaldo.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadLogs = async () => {
    setDownloadingLogs(true);

    try {
      const result = await descargarLogsAdmin();
      toast.success(`${result.total} logs descargados.`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudieron descargar los logs.');
    } finally {
      setDownloadingLogs(false);
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
        <MaintenanceCard
          title="Última exportación"
          value={lastBackup?.fecha ? fDateTime(lastBackup.fecha) : 'Sin respaldo'}
          caption={lastBackup?.archivo || 'Aún no hay respaldo registrado.'}
          icon="solar:archive-down-bold"
        />
        <MaintenanceCard
          title="Colecciones"
          value={collections.length}
          caption={`${collections.filter((item) => item.status === 'inconsistente').length} inconsistentes`}
          icon="solar:database-bold"
        />
        <MaintenanceCard
          title="Registros revisados"
          value={collections.reduce((total, item) => total + Number(item.count || 0), 0)}
          caption={loading ? 'Actualizando...' : 'Según conteo de Firestore'}
          icon="solar:chart-square-bold"
        />
      </Box>

      <Card>
        <CardHeader
          title="Modo mantenimiento / respaldo"
          subheader="Exporta datos clave, descarga logs y revisa colecciones vacías o inconsistentes."
          action={
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                color="inherit"
                variant="outlined"
                loading={loading}
                startIcon={<Iconify icon="solar:refresh-bold" />}
                onClick={loadMaintenance}
              >
                Actualizar
              </Button>
              <Button
                color="inherit"
                variant="outlined"
                loading={downloadingLogs}
                startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
                onClick={handleDownloadLogs}
              >
                Descargar logs
              </Button>
              <Button
                variant="contained"
                loading={exporting}
                startIcon={<Iconify icon="solar:archive-down-bold" />}
                onClick={handleExportBackup}
              >
                Exportar respaldo
              </Button>
            </Stack>
          }
        />

        <TableContainer sx={{ mt: 2 }}>
          <Scrollbar>
            <Table sx={{ minWidth: 760 }}>
              <TableHeadCustom headCells={TABLE_HEAD} />
              <TableBody>
                {collections.map((item) => (
                  <TableRow key={item.key} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{item.label}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {item.key}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell>
                      <Label color={STATUS_COLORS[item.status] || 'default'}>{item.status}</Label>
                    </TableCell>
                    <TableCell>{item.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>
    </Stack>
  );
}

function MaintenanceCard({ title, value, caption, icon }) {
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
