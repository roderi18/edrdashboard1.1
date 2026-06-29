'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { fData } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import {
  obtenerSaludSistemaAdmin,
  generarLogDetalladoSaludAdmin,
} from 'src/services/admin-system-health-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { useTable, rowInPage, TableHeadCustom, TablePaginationCustom } from 'src/components/table';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'area', label: 'Área', width: 150 },
  { id: 'name', label: 'Chequeo' },
  { id: 'value', label: 'Valor', width: 140 },
  { id: 'status', label: 'Estado', width: 140 },
  { id: 'detail', label: 'Detalle' },
];

const STATUS_COLORS = {
  correcto: 'success',
  advertencia: 'warning',
  critico: 'error',
};

const STATUS_LABELS = {
  correcto: 'Correcto',
  advertencia: 'Advertencia',
  critico: 'Crítico',
};

const STATUS_ICONS = {
  correcto: 'solar:check-circle-bold',
  advertencia: 'solar:danger-triangle-bold',
  critico: 'solar:shield-warning-bold',
};

export function AdminSystemHealthView() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingLog, setDownloadingLog] = useState(false);
  const table = useTable({ defaultRowsPerPage: 10 });

  const loadHealth = useCallback(async () => {
    setLoading(true);

    try {
      const result = await obtenerSaludSistemaAdmin();
      setHealth(result);
      table.onResetPage();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo cargar la salud del sistema.');
    } finally {
      setLoading(false);
    }
  }, [table.onResetPage]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleDownloadDetailedLog = useCallback(async () => {
    setDownloadingLog(true);

    try {
      const contenido = await generarLogDetalladoSaludAdmin(health);
      const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `salud-sistema-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo generar el log detallado.');
    } finally {
      setDownloadingLog(false);
    }
  }, [health]);

  const summary = health?.summary;
  const storagePercent = Number(health?.metrics?.storagePercent || 0);
  const checks = health?.checks || [];
  const totalWarnings = checks.filter((item) => item.status === 'advertencia').length;
  const totalCritical = checks.filter((item) => item.status === 'critico').length;
  const checksInPage = rowInPage(checks, table.page, table.rowsPerPage);

  if (loading && !health) {
    return <SystemHealthSkeleton />;
  }

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                color: `${STATUS_COLORS[summary?.status] || 'info'}.main`,
                bgcolor: `${STATUS_COLORS[summary?.status] || 'info'}.lighter`,
              }}
            >
              <Iconify icon={STATUS_ICONS[summary?.status] || 'solar:shield-check-bold'} width={30} />
            </Box>

            <Box>
              <Typography variant="h5">Panel de salud del sistema</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Estado general: {summary?.label || 'Sin datos'} · {summary?.detail || 'No revisado'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                Última revisión: {health?.generatedAt ? fDateTime(health.generatedAt) : 'Sin revisar'}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              gap: 1,
              width: { xs: 1, md: 'auto' },
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr) minmax(0, 1fr)',
                md: 'auto auto auto',
              },
              '& .MuiButton-root': {
                minWidth: 0,
                width: 1,
                px: { xs: 0.75, sm: 2 },
                fontSize: { xs: '0.78rem', sm: '0.875rem' },
                whiteSpace: 'nowrap',
              },
              '& .MuiButton-startIcon': {
                mr: { xs: 0.5, sm: 1 },
              },
            }}
          >
            <Button
              color="inherit"
              variant="outlined"
              component={RouterLink}
              href={paths.dashboard.admin.maintenance}
              startIcon={<Iconify icon="solar:database-bold" />}
            >
              Mantenimiento
            </Button>
            <Button
              variant="contained"
              loading={loading}
              onClick={loadHealth}
              startIcon={<Iconify icon="solar:refresh-bold" />}
            >
              Actualizar salud
            </Button>
            <Button
              color="inherit"
              variant="outlined"
              loading={downloadingLog}
              disabled={!health}
              onClick={handleDownloadDetailedLog}
              startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
            >
              Descargar log
            </Button>
          </Box>
        </Stack>
      </Card>

      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        <HealthMetricCard
          title="Críticos"
          value={totalCritical}
          icon="solar:shield-warning-bold"
          color="error"
        />
        <HealthMetricCard
          title="Advertencias"
          value={totalWarnings}
          icon="solar:danger-triangle-bold"
          color="warning"
        />
        <HealthMetricCard
          title="Registros"
          value={health?.metrics?.totalRecords || 0}
          icon="solar:database-bold"
          color="info"
        />
        <HealthMetricCard
          title="Pendientes"
          value={health?.metrics?.unreadNotifications || 0}
          icon="solar:bell-bing-bold"
          color="secondary"
        />
      </Box>

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Card>
          <CardHeader
            title="Storage"
            subheader="Este dato usa cache para no recorrer Firebase Storage desde este panel."
          />
          <Stack spacing={2.5} sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Uso actual
              </Typography>
              <Typography variant="subtitle2">{storagePercent}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(storagePercent, 100)}
              color={storagePercent >= 90 ? 'error' : storagePercent >= 75 ? 'warning' : 'success'}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Usado: {fData(health?.storage?.usedBytes || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Límite: {fData(health?.storage?.limitBytes || 0)}
              </Typography>
            </Stack>
            <Divider />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Archivos detectados en cache: {health?.storage?.totalFiles || 0}
            </Typography>
            <Link component={RouterLink} href={paths.dashboard.general.file} variant="body2">
              Abrir archivos para recalcular Storage
            </Link>
          </Stack>
        </Card>

        <Card>
          <CardHeader title="Últimas señales" subheader="Auditoría y respaldo administrativo." />
          <Stack spacing={2.5} sx={{ p: 3 }}>
            <HealthSignal
              title="Último respaldo"
              value={health?.backup?.fecha ? fDateTime(health.backup.fecha) : 'Sin respaldo'}
              caption={health?.backup?.archivo || 'No hay respaldo registrado.'}
              icon="solar:archive-down-bold"
            />
            <HealthSignal
              title="Último log"
              value={health?.latestLog?.accion || 'Sin auditoría reciente'}
              caption={health?.latestLog?.fecha ? fDateTime(health.latestLog.fecha) : 'Sin fecha'}
              icon="solar:history-2-bold"
            />
            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                color="inherit"
                variant="outlined"
                component={RouterLink}
                href={paths.dashboard.admin.logs}
              >
                Ver logs
              </Button>
              <Button
                fullWidth
                color="inherit"
                variant="outlined"
                component={RouterLink}
                href={paths.dashboard.admin.notifications}
              >
                Ver notificaciones
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Box>

      <Card>
        <CardHeader
          title="Chequeos del sistema"
          subheader="Lectura rápida de configuración, datos clave, auditoría, Storage y notificaciones."
        />

        <TableContainer sx={{ mt: 2 }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 860 }}>
              <TableHeadCustom headCells={TABLE_HEAD} />
              <TableBody>
                {checksInPage.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.area}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2">{item.name}</Typography>
                    </TableCell>
                    <TableCell>{item.value}</TableCell>
                    <TableCell>
                      <Label color={STATUS_COLORS[item.status] || 'default'}>
                        {STATUS_LABELS[item.status] || item.status}
                      </Label>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{item.detail}</TableCell>
                  </TableRow>
                ))}

                {!checks.length && (
                  <TableRow>
                    <TableCell colSpan={TABLE_HEAD.length} sx={{ color: 'text.secondary' }}>
                      Sin chequeos disponibles.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          page={table.page}
          dense={table.dense}
          count={checks.length}
          rowsPerPage={table.rowsPerPage}
          onPageChange={table.onChangePage}
          onChangeDense={table.onChangeDense}
          onRowsPerPageChange={table.onChangeRowsPerPage}
        />
      </Card>
    </Stack>
  );
}

function HealthMetricCard({ title, value, icon, color }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            color: `${color}.main`,
            bgcolor: `${color}.lighter`,
          }}
        >
          <Iconify icon={icon} width={22} />
        </Box>
        <Box>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

function HealthSignal({ title, value, caption, icon }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: 'primary.lighter',
          flexShrink: 0,
        }}
      >
        <Iconify icon={icon} width={22} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" noWrap>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
          {caption}
        </Typography>
      </Box>
    </Stack>
  );
}

function SystemHealthSkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={128} />
      <Box
        sx={{
          gap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
        }}
      >
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} variant="rounded" height={128} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={360} />
    </Stack>
  );
}
