'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { DashboardContent } from 'src/layouts/dashboard';
import { obtenerSolicitudesPendientesParaCoordinador } from 'src/services/solicitudes-cambio-miembro-service';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const getUserMemberId = (user = {}) =>
  user?.idMiembros ?? user?.memberIdNumber ?? user?.member?.idMiembros ?? user?.id ?? null;

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const formatFecha = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

// ----------------------------------------------------------------------

export function MemberChangeRequestsView() {
  const { user } = useAuthContext();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [solicitudes, setSolicitudes] = useState([]);

  const idMiembros = getUserMemberId(user);

  const cargar = useCallback(async () => {
    if (!idMiembros) {
      setSolicitudes([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const pendientes = await obtenerSolicitudesPendientesParaCoordinador(idMiembros);
      setSolicitudes(pendientes);
    } catch (error) {
      console.error('[solicitudes de cambio] no se pudieron cargar', error);
      setSolicitudes([]);
    } finally {
      setLoading(false);
    }
  }, [idMiembros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const revisar = (solicitud) => {
    const segmento = solicitud?.codigoMiembro || solicitud?.idMiembros;

    if (!segmento) return;

    router.push(
      `${paths.dashboard.level.member.edit(encodeURIComponent(segmento))}?solicitud=${solicitud.id}`
    );
  };

  const renderList = () => (
    <Stack spacing={2}>
      {solicitudes.map((solicitud) => (
        <Card key={solicitud.id} sx={{ p: 2.5 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.dark' }}>
                {getInitials(solicitud.nombreMiembro)}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" noWrap>
                    {solicitud.nombreMiembro || 'Miembro'}
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      px: 0.75,
                      borderRadius: 0.75,
                      typography: 'caption',
                      fontFamily: 'monospace',
                      bgcolor: 'background.neutral',
                    }}
                  >
                    {solicitud.codigoMiembro || '—'}
                  </Box>
                </Stack>

                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {(solicitud.cambios?.length || 0)} cambio
                  {(solicitud.cambios?.length || 0) === 1 ? '' : 's'} · enviado por{' '}
                  {solicitud.solicitadoPorNombre || 'Líder de Grupo'}
                  {solicitud.fechaCreacion ? ` · ${formatFecha(solicitud.fechaCreacion)}` : ''}
                </Typography>
              </Box>
            </Stack>

            <Button
              variant="contained"
              onClick={() => revisar(solicitud)}
              startIcon={<Iconify icon="solar:eye-bold" />}
              sx={{ flexShrink: 0 }}
            >
              Revisar
            </Button>
          </Stack>
        </Card>
      ))}
    </Stack>
  );

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Solicitudes de cambio"
        links={[
          { name: 'Panel', href: paths.dashboard.root },
          { name: 'Miembros', href: paths.dashboard.level.member.root },
          { name: 'Solicitudes de cambio' },
        ]}
        action={
          <Button
            color="inherit"
            variant="outlined"
            onClick={cargar}
            startIcon={<Iconify icon="solar:refresh-linear" />}
          >
            Actualizar
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {loading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} variant="rounded" height={92} />
          ))}
        </Stack>
      ) : solicitudes.length ? (
        renderList()
      ) : (
        <EmptyContent
          filled
          title="No tienes solicitudes pendientes"
          description="Aquí aparecerán los cambios que los líderes de grupo envíen para tu aprobación."
          sx={{ py: 10 }}
        />
      )}
    </DashboardContent>
  );
}
