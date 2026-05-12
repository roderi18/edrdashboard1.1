'use client';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';

import { DashboardContent } from 'src/layouts/dashboard';
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
import { AppCurrentDownload } from '../app-current-download';
import { AppTopInstalledCountries } from '../app-top-installed-countries';

// ----------------------------------------------------------------------

export function PrincipalAppView() {
  const { user } = useAuthContext();
  const theme = useTheme();
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

        <Grid size={{ xs: 12 }}>
          <Box
            sx={{
              gap: 3,
              display: 'flex',
              alignItems: 'stretch',
              flexDirection: { xs: 'column', md: 'row' },
            }}
          >
            <AppCurrentDownload
              title="Descargas actuales"
              subheader="Reels y videos de YouTube"
            />

            <AppFeatured
              list={_appFeatured}
              sx={{ flex: '1 1 auto', minWidth: 0, alignSelf: 'flex-start' }}
              imageSx={{ height: { xs: 288, md: 480, xl: 560 } }}
            />
          </Box>
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
