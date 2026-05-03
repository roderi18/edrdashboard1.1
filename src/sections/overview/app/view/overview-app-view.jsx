'use client';

import dayjs from 'dayjs';
import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { SeoIllustration } from 'src/assets/illustrations';
import { _appAuthors, _appRelated, _appFeatured, _appInvoices, _appInstalled } from 'src/_mock';

import { svgColorClasses } from 'src/components/svg-color';

import { useAuthContext } from 'src/auth/hooks';

import { AppWidget } from '../app-widget';
import { AppWelcome } from '../app-welcome';
import { AppFeatured } from '../app-featured';
import { AppTopAuthors } from '../app-top-authors';
import { AppTopRelated } from '../app-top-related';
import { AppNewInvoices } from '../app-new-invoices';
import { AppAreaInstalled } from '../app-area-installed';
import { AppWidgetSummary } from '../app-widget-summary';
import { AppCurrentDownload } from '../app-current-download';
import { AppTopInstalledCountries } from '../app-top-installed-countries';

// ----------------------------------------------------------------------

const METRIC_DAYS = 7;
const CHART_DAYS = 8;
const DELETED_STATUSES = new Set(['deleted', 'eliminado']);

function getValidDate(value) {
  if (!value) return null;

  const parsedDate = dayjs(value);

  return parsedDate.isValid() ? parsedDate : null;
}

function isMemberDeleted(member) {
  const normalizedStatus = String(member?.status || '')
    .trim()
    .toLowerCase();

  return DELETED_STATUSES.has(normalizedStatus) || Boolean(member?.deletedAt);
}

function calculatePercentChange(currentValue, previousValue) {
  if (!previousValue) {
    return currentValue > 0 ? 100 : 0;
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

function createRangeLabels(days) {
  return Array.from({ length: days }, (_, index) =>
    dayjs().subtract(days - index - 1, 'day').format('DD MMM')
  );
}

function countMembersInRange(members, getDate, startDate, endDate) {
  return members.filter((member) => {
    const date = getDate(member);

    return date && !date.isBefore(startDate) && date.isBefore(endDate);
  }).length;
}

function buildMemberMetrics(members) {
  const now = dayjs();
  const currentWindowStart = now.subtract(METRIC_DAYS, 'day').startOf('day');
  const previousWindowStart = currentWindowStart.subtract(METRIC_DAYS, 'day');
  const chartLabels = createRangeLabels(CHART_DAYS);
  const availableMembers = members.filter((member) => !isMemberDeleted(member));
  const getCreatedAt = (member) => getValidDate(member.createdAt);
  const getActivityAt = (member) =>
    getValidDate(member.lastActivityAt) || getValidDate(member.updatedAt) || getCreatedAt(member);

  const totalRegisteredNow = availableMembers.length;
  const totalRegisteredPrevious = availableMembers.filter((member) => {
    const createdAt = getCreatedAt(member);

    return createdAt && createdAt.isBefore(currentWindowStart);
  }).length;

  const newUsersCurrent = countMembersInRange(
    availableMembers,
    getCreatedAt,
    currentWindowStart,
    now.add(1, 'millisecond')
  );
  const newUsersPrevious = countMembersInRange(
    availableMembers,
    getCreatedAt,
    previousWindowStart,
    currentWindowStart
  );

  const activeUsersCurrent = countMembersInRange(
    availableMembers,
    getActivityAt,
    currentWindowStart,
    now.add(1, 'millisecond')
  );
  const activeUsersPrevious = countMembersInRange(
    availableMembers,
    getActivityAt,
    previousWindowStart,
    currentWindowStart
  );

  const totalRegisteredSeries = chartLabels.map((_, index) => {
    const dayEnd = now.subtract(CHART_DAYS - index - 1, 'day').endOf('day');

    return availableMembers.filter((member) => {
      const createdAt = getCreatedAt(member);

      return createdAt && !createdAt.isAfter(dayEnd);
    }).length;
  });

  const newUsersSeries = chartLabels.map((_, index) => {
    const dayStart = now.subtract(CHART_DAYS - index - 1, 'day').startOf('day');
    const dayEnd = dayStart.endOf('day');

    return countMembersInRange(
      availableMembers,
      getCreatedAt,
      dayStart,
      dayEnd.add(1, 'millisecond')
    );
  });

  const activeUsersSeries = chartLabels.map((_, index) => {
    const dayStart = now.subtract(CHART_DAYS - index - 1, 'day').startOf('day');
    const dayEnd = dayStart.endOf('day');

    return countMembersInRange(
      availableMembers,
      getActivityAt,
      dayStart,
      dayEnd.add(1, 'millisecond')
    );
  });

  return {
    activeUsers: {
      total: activeUsersCurrent,
      percent: calculatePercentChange(activeUsersCurrent, activeUsersPrevious),
      chart: { categories: chartLabels, series: activeUsersSeries },
    },
    totalRegistered: {
      total: totalRegisteredNow,
      percent: calculatePercentChange(totalRegisteredNow, totalRegisteredPrevious),
      chart: { categories: chartLabels, series: totalRegisteredSeries },
    },
    newUsers: {
      total: newUsersCurrent,
      percent: calculatePercentChange(newUsersCurrent, newUsersPrevious),
      chart: { categories: chartLabels, series: newUsersSeries },
    },
  };
}

export function OverviewAppView() {
  const { user } = useAuthContext();
  const theme = useTheme();
  const [memberMetrics, setMemberMetrics] = useState(() => buildMemberMetrics([]));
  const monthlyCategories = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const regionalUsersByYear = [
    {
      name: '2026',
      data: [
        { name: 'Región Central', data: [14, 22, 18, 21, 25, 20, 28, 24, 19, 30, 23, 27] },
        { name: 'Región Sur', data: [9, 14, 12, 13, 16, 12, 18, 15, 11, 17, 14, 16] },
        { name: 'Región Este', data: [7, 11, 9, 10, 13, 9, 15, 12, 10, 14, 11, 12] },
        { name: 'Región Norte', data: [5, 8, 7, 8, 10, 7, 11, 9, 8, 12, 9, 10] },
      ],
    },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadDashboardMetrics = async () => {
      const members = await getMembers();

      if (!isMounted) return;

      setMemberMetrics(buildMemberMetrics(members));
    };

    loadDashboardMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <DashboardContent maxWidth="xl">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <AppWelcome
            title={`Bienvenido de nuevo\n${user?.displayName || user?.nombre || user?.email || ''}`}
            description="Aquí tienes un resumen rápido de la actividad más importante del panel."
            img={<SeoIllustration hideBackground />}
            action={
              <Button variant="contained" color="primary">
                Ir ahora
              </Button>
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <AppFeatured list={_appFeatured} />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <AppWidgetSummary
            title="Usuarios activos"
            percent={memberMetrics.activeUsers.percent}
            total={memberMetrics.activeUsers.total}
            chart={memberMetrics.activeUsers.chart}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <AppWidgetSummary
            title="Total de usuarios registrados"
            percent={memberMetrics.totalRegistered.percent}
            total={memberMetrics.totalRegistered.total}
            chart={{
              ...memberMetrics.totalRegistered.chart,
              colors: [theme.palette.info.main],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <AppWidgetSummary
            title="Usuarios nuevos"
            percent={memberMetrics.newUsers.percent}
            total={memberMetrics.newUsers.total}
            chart={{
              ...memberMetrics.newUsers.chart,
              colors: [theme.palette.error.main],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <AppCurrentDownload
            title="Descargas actuales"
            subheader="Descargas por sistema operativo"
            chart={{
              series: [
                { label: 'Mac', value: 12244 },
                { label: 'Windows', value: 53345 },
                { label: 'iOS', value: 44313 },
                { label: 'Android', value: 78343 },
              ],
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 8 }}>
          <AppAreaInstalled
            title="Usuarios por región"
            subheader="Usuarios registrados por mes durante 2026"
            chart={{
              colors: [
                theme.palette.primary.dark,
                theme.palette.warning.main,
                theme.palette.info.main,
                theme.palette.success.main,
              ],
              categories: monthlyCategories,
              series: regionalUsersByYear,
            }}
          />
        </Grid>

        <Grid size={{ xs: 12, lg: 8 }}>
          <AppNewInvoices
            title="Facturas nuevas"
            tableData={_appInvoices}
            headCells={[
              { id: 'id', label: 'ID de factura' },
              { id: 'category', label: 'Categoría' },
              { id: 'price', label: 'Precio' },
              { id: 'status', label: 'Estado' },
              { id: '' },
            ]}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <AppTopRelated title="Documentos más utilizados" list={_appRelated} />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <AppTopInstalledCountries title="Provincias con más usuarios" list={_appInstalled} />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <AppTopAuthors title="Miembros más activos" list={_appAuthors} />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <AppWidget
              title="Interacción con las publicidades"
              total={38566}
              icon="solar:user-rounded-bold"
              chart={{ series: 48 }}
            />

            <AppWidget
              title="Aplicaciones"
              total={55566}
              icon="solar:letter-bold"
              chart={{
                series: 75,
                colors: [theme.vars.palette.info.light, theme.vars.palette.info.main],
              }}
              sx={{ bgcolor: 'info.dark', [`& .${svgColorClasses.root}`]: { color: 'info.light' } }}
            />
          </Box>
        </Grid>
      </Grid>
    </DashboardContent>
  );
}
