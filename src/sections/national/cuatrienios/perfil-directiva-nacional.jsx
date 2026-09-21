'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { DashboardContent } from 'src/layouts/dashboard';

import { obtenerPerfilDirectivaHistorica } from 'src/catalogs/directiva-perfil-2022-2026.mjs';

const rutaDePestana = (integrante, pestaña) => {
  const term = encodeURIComponent(String(integrante.cuatrienio || ''));
  const row = encodeURIComponent(String(integrante.id || ''));
  const route = `/dashboard/level/member/${row}/edit${pestaña === 'historial' ? '/history' : ''}`;

  return `${route}?cuatrienio=${term}&integrante=${row}`;
};

const valorDeDestacamento = (integrante, perfil) => {
  if (perfil?.seccionPropuesta === 'No asignar') return 'Sin asignar';
  if (perfil?.seccionPropuesta) return perfil.seccionPropuesta;
  if (integrante?.seccionNombre) return integrante.seccionNombre;
  return integrante?.nivel === 'nacional' ? 'Provisional' : 'Sin dato en esta instantánea';
};

const valorDeCargo = (integrante, perfil) => {
  if (perfil?.cargoNacional) return perfil.cargoNacional;
  if (perfil?.cargoExcluido || integrante?.grupo === 'ex_comandantes') {
    return 'Sin asignación (Ex Comandante Nacional)';
  }

  return integrante?.cargoNombre || 'Sin cargo registrado';
};

function Dato({ etiqueta, valor }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {etiqueta}
      </Typography>
      <Typography variant="body1" sx={{ overflowWrap: 'anywhere' }}>
        {valor || 'Sin dato en esta instantánea'}
      </Typography>
    </Box>
  );
}

export function PerfilDirectivaNacional({ integrante, activeTab = 'general' }) {
  const perfil = obtenerPerfilDirectivaHistorica(integrante?.idMiembros);
  const nombre = [integrante?.nombres, integrante?.apellidos].filter(Boolean).join(' ').trim();
  const esExComandanteSinCargo =
    (perfil?.cargoExcluido || integrante?.grupo === 'ex_comandantes') && !perfil?.cargoNacional;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={`Perfil de Directiva Nacional ${integrante?.cuatrienio || ''}`}
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          {
            name: 'Consejo Nacional',
            href: `${paths.dashboard.level.national.root}?cuatrienio=${encodeURIComponent(integrante?.cuatrienio || '')}`,
          },
          { name: nombre || 'Integrante' },
        ]}
        slotProps={{ breadcrumbs: { separator: '•' } }}
        sx={{ mb: 3 }}
      />

      <Tabs value={activeTab} sx={{ mb: { xs: 3, md: 5 } }}>
        <Tab component="a" label="General" value="general" href={rutaDePestana(integrante, 'general')} />
        <Tab component="a" label="Historial" value="historial" href={rutaDePestana(integrante, 'historial')} />
      </Tabs>

      {activeTab === 'general' ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                p: 3,
                height: 1,
                border: '1px solid',
                borderColor: 'warning.main',
              }}
            >
              <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center' }}>
                <Avatar
                  src={integrante?.fotoUrl || undefined}
                  alt={nombre}
                  sx={{ width: 112, height: 112, borderRadius: 3 }}
                >
                  {nombre.slice(0, 1).toUpperCase()}
                </Avatar>
                <Typography variant="h6">{nombre || 'Integrante'}</Typography>
              </Stack>

              <Divider sx={{ my: 3 }} />
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Este perfil corresponde a la Directiva Nacional del cuatrienio{' '}
                {integrante?.cuatrienio || ''}.
              </Typography>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 3,
                }}
              >
                <Dato etiqueta="Nombres" valor={integrante?.nombres} />
                <Dato etiqueta="Apellidos" valor={integrante?.apellidos} />
                <Dato etiqueta="Tu Destacamento" valor={valorDeDestacamento(integrante, perfil)} />
                <Dato etiqueta="Cargo Nacional" valor={valorDeCargo(integrante, perfil)} />
                <Dato
                  etiqueta="Instructor CI"
                  valor={esExComandanteSinCargo ? 'No aplica a esta posición' : 'Sin dato en esta instantánea'}
                />
              </Box>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Historial de la ficha histórica
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Esta instantánea no guarda cambios de perfil individuales. Aquí no se muestra el
            historial del perfil real del miembro.
          </Typography>
        </Card>
      )}
    </DashboardContent>
  );
}
