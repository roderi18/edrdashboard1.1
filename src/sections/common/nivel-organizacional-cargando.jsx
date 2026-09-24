import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

import { DashboardContent } from 'src/layouts/dashboard';

import { OrganigramaCargando } from './organigrama-cargando';
import { OrganizationalTabSkeleton } from './organizational-tab-skeleton';

// ----------------------------------------------------------------------
// LA PRÓXIMA PANTALLA, AL MOMENTO DE PULSAR.
//
// Qué se rompía: al pulsar una entrada del menú, una fila o una pestaña de los
// niveles organizacionales, la pantalla se quedaba quieta hasta que llegaba la
// siguiente (sin nada en medio, o con el splash de todo el panel): parecía
// congelada. Cada ruta tiene ahora su `loading.jsx` con la forma de lo que
// viene —lista, organigrama o ficha—, que el App Router precarga y enseña en el
// mismo clic.
// ----------------------------------------------------------------------

/** Filas con cara, nombre y dos columnas, para cualquier lista. */
export function FilasDeTabla({ filas = 6 }) {
  return (
    <Stack spacing={0}>
      {Array.from({ length: filas }, (_, indice) => (
        <Stack
          key={indice}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ px: 2.5, py: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}
        >
          <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="25%" />
          </Stack>
          <Skeleton variant="text" width="18%" sx={{ display: { xs: 'none', md: 'block' } }} />
          <Skeleton variant="text" width="14%" sx={{ display: { xs: 'none', md: 'block' } }} />
        </Stack>
      ))}
    </Stack>
  );
}

/** Tarjeta de lista: pestañas, filtros y filas. Sin marco, para las pestañas de una ficha. */
export function TablaOrganizacionalCargando({ filas }) {
  return (
    <Card aria-label="Cargando lista" aria-busy="true">
      <Stack direction="row" spacing={3} sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
        <Skeleton variant="text" width={72} height={32} />
        <Skeleton variant="text" width={88} height={32} />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2.5, pt: 1 }}>
        <Skeleton variant="rounded" height={48} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={48} sx={{ width: { md: 200 } }} />
        <Skeleton variant="rounded" height={48} sx={{ width: { md: 200 } }} />
      </Stack>

      <FilasDeTabla filas={filas} />
    </Card>
  );
}

/** Pantalla de lista de un nivel (Consejo Nacional, Regiones, Secciones...). */
export function ListaOrganizacionalCargando() {
  return (
    <DashboardContent>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        <Box>
          <Skeleton variant="text" width={260} height={44} />
          <Skeleton variant="text" width={180} />
        </Box>
        <Skeleton variant="rounded" width={120} height={36} />
      </Stack>

      <TablaOrganizacionalCargando />
    </DashboardContent>
  );
}

/** Pestaña "Directiva" de una ficha: el cuadro del organigrama. */
export function PestanaOrganigramaCargando() {
  return (
    <Card sx={{ p: 2 }}>
      <OrganigramaCargando />
    </Card>
  );
}

/** Pantalla de alta ("Nuevo ..."): encabezado y formulario. */
export function FormularioOrganizacionalCargando() {
  return (
    <DashboardContent>
      <Skeleton variant="text" width={260} height={44} sx={{ mb: { xs: 3, md: 5 } }} />
      <OrganizationalTabSkeleton />
    </DashboardContent>
  );
}
