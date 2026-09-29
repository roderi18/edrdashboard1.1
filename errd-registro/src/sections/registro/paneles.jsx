'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

import { PASOS } from './esquema';

// ----------------------------------------------------------------------
// Panel izquierdo (los pasos) y derecho ("¿Por qué registrar?") de la maqueta.
// ----------------------------------------------------------------------

export function PasosLaterales({ paso }) {
  return (
    <Card
      sx={(t) => ({
        p: 3,
        color: 'common.white',
        display: { xs: 'none', lg: 'block' },
        position: 'sticky',
        top: 24,
        backgroundImage: `linear-gradient(180deg, ${t.vars.palette.primary.darker}, ${t.vars.palette.primary.dark})`,
      })}
    >
      <Box component="img" alt="" src="/logo/emblema-erd.png" sx={{ width: 64, height: 64, mb: 2 }} />
      <Typography variant="h4" sx={{ mb: 1 }}>
        Registrar Destacamento
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, mb: 3 }}>
        Completa el formulario con la información de tu destacamento. Se verificará por la Oficina Nacional Exploradores del Rey, Rep. Dom.
      </Typography>

      <Stack spacing={1}>
        {PASOS.map((p, i) => {
          const activo = i === paso;
          const hecho = i < paso;
          return (
            <Stack
              key={p.id}
              direction="row"
              spacing={1.5}
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1,
                alignItems: 'center',
                bgcolor: activo ? 'primary.main' : 'transparent',
                opacity: activo || hecho ? 1 : 0.65,
              }}
            >
              <Iconify icon={hecho ? 'solar:check-circle-bold' : p.icono} width={20} />
              <Typography variant={activo ? 'subtitle2' : 'body2'}>{p.corto}</Typography>
            </Stack>
          );
        })}
      </Stack>

    </Card>
  );
}

const RAZONES = [
  { icono: 'solar:bill-list-bold', texto: 'Un registro nacional ordenado y al día.' },
  { icono: 'solar:verified-check-bold', texto: 'Información completa de cada destacamento.' },
  { icono: 'solar:phone-bold', texto: 'Contacto directo con cada directiva.' },
  { icono: 'eva:trending-up-fill', texto: 'Planificación basada en datos reales.' },
];

export function PanelPorQueRegistrar() {
  return (
    <Stack spacing={3} sx={{ display: { xs: 'none', lg: 'flex' }, position: 'sticky', top: 24 }}>
      <Card
        sx={(t) => ({
          p: 3,
          minHeight: 180,
          display: 'flex',
          alignItems: 'flex-end',
          color: 'common.white',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `linear-gradient(0deg, ${varAlpha(t.vars.palette.grey['900Channel'], 0.8)}, transparent), url(/fotos/campamento-movil.webp)`,
        })}
      >
        <Box>
          <Typography sx={{ fontStyle: 'italic', typography: 'h6', fontWeight: 400 }}>
            Influir en la vida de más niños y jóvenes que nunca, de una manera más efectiva que nunca.
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            — Exploradores del Rey
          </Typography>
        </Box>
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          ¿Por qué registrar?
        </Typography>
        <Stack spacing={2.5}>
          {RAZONES.map((r) => (
            <Stack key={r.texto} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  p: 1,
                  display: 'flex',
                  borderRadius: 1.5,
                  color: 'primary.main',
                  bgcolor: 'primary.lighter',
                }}
              >
                <Iconify icon={r.icono} width={22} />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {r.texto}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
