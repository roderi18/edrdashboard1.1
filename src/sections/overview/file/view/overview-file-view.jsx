'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';

import { fData } from 'src/utils/format-number';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

import { FileDataActivity } from 'src/sections/file-manager/file-data-activity';
import { FileStorageOverview } from 'src/sections/file-manager/file-storage-overview';

// ----------------------------------------------------------------------

const SYSTEM_TABS = [
  { value: 'files', label: 'Archivos', icon: 'solar:folder-bold' },
  { value: 'api', label: 'API', icon: 'solar:server-bold' },
  { value: 'database', label: 'Base de datos', icon: 'solar:database-bold' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString('es-DO');

const hasChartData = (chart) =>
  chart?.series?.some((series) =>
    series.data?.some((item) => item.data?.some((value) => Number(value) > 0))
  );

const renderMetricIcon = (icon, color = 'primary.main') => (
  <Box
    sx={{
      width: 36,
      height: 36,
      display: 'grid',
      borderRadius: 1,
      placeItems: 'center',
      bgcolor: 'background.neutral',
      color,
    }}
  >
    <Iconify icon={icon || 'solar:database-bold'} width={22} />
  </Box>
);

function MetricWidget({ widget, countLabel }) {
  return (
    <Card sx={{ p: 3, height: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        {renderMetricIcon(widget.icon)}
        <IconButton size="small">
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Stack>

      <Typography variant="h6" sx={{ mt: 3 }}>
        {widget.title}
      </Typography>

      <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
        {formatNumber(widget.count)} {countLabel}
      </Typography>

      <LinearProgress
        value={widget.total ? Math.min(100, (widget.value / widget.total) * 100) : 0}
        variant="determinate"
        color="inherit"
        sx={{ my: 2, height: 6 }}
      />

      <Typography variant="subtitle2" align="right">
        {fData(widget.value)}
      </Typography>
    </Card>
  );
}

function MetricModuleCard({ module }) {
  return (
    <Card sx={{ p: 2.5, height: 1 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        {renderMetricIcon(module.icon, 'success.main')}

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" noWrap>
            {module.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {module.type} - {module.count}
          </Typography>
        </Box>

        <Typography variant="subtitle2">{fData(module.size)}</Typography>
      </Stack>
    </Card>
  );
}

function MetricsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <Grid key={item} size={{ xs: 12, md: 4 }}>
          <Skeleton variant="rounded" height={178} />
        </Grid>
      ))}
      <Grid size={{ xs: 12, lg: 8 }}>
        <Skeleton variant="rounded" height={430} />
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Skeleton variant="rounded" height={430} />
      </Grid>
    </>
  );
}

// ----------------------------------------------------------------------

export function OverviewFileView() {
  const [tab, setTab] = useState('files');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  const loadMetrics = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/system-metrics/', { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('No se pudieron cargar las metricas reales.');
      }

      setMetrics(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const currentView = metrics?.views?.[tab];

  const categories = useMemo(
    () =>
      (currentView?.categories || []).map((category) => ({
        ...category,
        icon: renderMetricIcon(category.icon),
      })),
    [currentView]
  );

  const sources = useMemo(
    () =>
      (currentView?.categories || []).flatMap((category) =>
        (category.sources || []).map((source) => ({
          ...source,
          category: category.name,
        }))
      ),
    [currentView]
  );

  const handleChangeTab = useCallback((event, newValue) => {
    setTab(newValue);
  }, []);

  const handleExport = useCallback(() => {
    if (!currentView) return;

    const report = {
      tab,
      updatedAt: metrics?.updatedAt,
      view: currentView,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `metricas-${tab}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [currentView, metrics?.updatedAt, tab]);

  return (
    <DashboardContent
      maxWidth="xl"
      sx={{
        '--layout-dashboard-content-pt': '16px',
        '--layout-dashboard-content-pb': '24px',
      }}
    >
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Tabs value={tab} onChange={handleChangeTab}>
            {SYSTEM_TABS.map((item) => (
              <Tab
                key={item.value}
                value={item.value}
                label={item.label}
                icon={<Iconify icon={item.icon} width={20} />}
                iconPosition="start"
              />
            ))}
          </Tabs>

          <Stack direction="row" spacing={1}>
            <Button
              color="inherit"
              onClick={loadMetrics}
              disabled={loading}
              startIcon={<Iconify icon="solar:refresh-bold" />}
            >
              Actualizar
            </Button>
            <Button
              variant="contained"
              onClick={handleExport}
              disabled={!currentView}
              startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
            >
              Exportar
            </Button>
          </Stack>
        </Stack>

        {metrics?.updatedAt && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Actualizado: {new Date(metrics.updatedAt).toLocaleString('es-DO')}
          </Typography>
        )}

        <Grid container spacing={3}>
          {loading && <MetricsSkeleton />}

          {!loading && error && (
            <Grid size={{ xs: 12 }}>
              <Card sx={{ p: 3 }}>
                <Typography variant="subtitle1">No se pudieron cargar las metricas reales.</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                  {error}
                </Typography>
              </Card>
            </Grid>
          )}

          {!loading &&
            !error &&
            currentView?.widgets?.map((widget) => (
              <Grid key={widget.title} size={{ xs: 12, md: 4 }}>
                <MetricWidget widget={widget} countLabel={currentView.countLabel} />
              </Grid>
            ))}

          {!loading && !error && currentView && (
            <>
              <Grid size={{ xs: 12, lg: 8 }}>
                {hasChartData(currentView.chart) ? (
                  <FileDataActivity
                    title={currentView.title}
                    subheader="Conteos y espacio medidos desde la base de datos/API"
                    chart={currentView.chart}
                    sx={{ height: 1 }}
                  />
                ) : (
                  <Card sx={{ p: 3, minHeight: 430 }}>
                    <Typography variant="h6">{currentView.title}</Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      No hay fechas registradas para graficar esta seccion.
                    </Typography>
                  </Card>
                )}
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }}>
                <FileStorageOverview
                  data={categories}
                  used={currentView.used}
                  total={currentView.total}
                  countLabel={currentView.countLabel}
                  chart={{ series: currentView.chartPercent }}
                  sx={{ height: 1 }}
                />
              </Grid>

              <Grid size={{ xs: 12, lg: 8 }}>
                <Card>
                  <CardHeader title="Elementos medidos" />
                  <CardContent>
                    <Grid container spacing={2}>
                      {(tab === 'database' ? metrics.moduleCards : currentView.categories).map((item) => (
                        <Grid key={item.name} size={{ xs: 12, md: 6 }}>
                          <MetricModuleCard
                            module={{
                              name: item.name,
                              type: tab === 'database' ? item.type : 'Medicion real',
                              count:
                                tab === 'database'
                                  ? item.count
                                  : `${formatNumber(item.filesCount)} ${currentView.countLabel}`,
                              size: item.size ?? item.usedStorage,
                              icon: item.icon,
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 4 }}>
                <Card sx={{ height: 1 }}>
                  <CardHeader title="Origenes" subheader="Colecciones y servicios consultados" />
                  <Divider />
                  <Stack spacing={2} sx={{ p: 3 }}>
                    {sources.map((source) => (
                      <Stack key={`${source.category}-${source.name}`} spacing={0.5}>
                        <Typography variant="subtitle2">{source.category}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                          {source.name}
                        </Typography>
                        {source.error && (
                          <Typography variant="caption" sx={{ color: 'error.main' }}>
                            {source.error}
                          </Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      </Stack>
    </DashboardContent>
  );
}
