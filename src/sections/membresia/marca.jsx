'use client';

import Link from 'next/link';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// La marca de la Oficina Nacional, la cabecera y el pie: los mismos en la
// portada y en los cuatro pasos del registro.
// ----------------------------------------------------------------------

export const RUTA_REGISTRO = '/registro/destacamento/';

export function Marca({ tamano = 52 }) {
  return (
    <Stack
      component={Link}
      href="/"
      direction="row"
      spacing={1.5}
      sx={{ alignItems: 'center', color: 'inherit', textDecoration: 'none' }}
    >
      <Box
        component="img"
        src="/marca/logo-oficina-nacional.webp"
        alt="Oficina Nacional de Exploradores del Rey"
        sx={{ width: tamano, height: tamano, flexShrink: 0 }}
      />
      <Box sx={{ lineHeight: 1.15 }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: 13, sm: 15 },
            lineHeight: 1.15,
          }}
        >
          OFICINA NACIONAL
        </Typography>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: 13, sm: 15 },
            lineHeight: 1.15,
          }}
        >
          EXPLORADORES DEL REY
        </Typography>
        <Typography sx={{ fontSize: 11, letterSpacing: 0.5, opacity: 0.8 }}>
          REPÚBLICA DOMINICANA
        </Typography>
      </Box>
    </Stack>
  );
}

const ENLACES = [
  ['Cómo funciona', '/#como-funciona'],
  ['Planes', '/#planes'],
  ['Avance nacional', '/#avance'],
];

export function Encabezado({ conBoton = true }) {
  return (
    <Box
      component="header"
      sx={(t) => ({
        py: 1.5,
        color: 'common.white',
        bgcolor: t.vars.palette.primary.darker,
      })}
    >
      <Container maxWidth="xl">
        <Stack
          direction="row"
          spacing={3}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Marca />
          <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
            <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {ENLACES.map(([texto, href]) => (
                <MuiLink
                  key={href}
                  component={Link}
                  href={href}
                  color="inherit"
                  underline="hover"
                  variant="subtitle2"
                >
                  {texto}
                </MuiLink>
              ))}
            </Stack>
            {conBoton && (
              <Button
                component={Link}
                href={RUTA_REGISTRO}
                variant="contained"
                color="primary"
                sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Registrar mi destacamento
              </Button>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

export function Pie() {
  return (
    <Box
      component="footer"
      sx={(t) => ({
        mt: { xs: 5, md: 8 },
        py: 3,
        color: 'common.white',
        bgcolor: t.vars.palette.primary.darker,
      })}
    >
      <Container maxWidth="xl">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 3, md: 5 }}
          sx={{
            alignItems: { xs: 'center', md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Stack spacing={1} sx={{ alignItems: { xs: 'center', md: 'flex-start' } }}>
            <Marca tamano={44} />
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              © {new Date().getFullYear()} Oficina Nacional de Exploradores del Rey, Rep. Dom.
            </Typography>
          </Stack>

          <Stack spacing={0.5} sx={{ alignItems: { xs: 'center', md: 'flex-start' } }}>
            <Typography variant="overline" sx={{ opacity: 0.7 }}>
              Contacto
            </Typography>
            <MuiLink
              href="mailto:tecnologia@errd.org.do?subject=Membres%C3%ADa%20ONERRD%202027"
              color="inherit"
              underline="hover"
              sx={{
                gap: 1,
                display: 'inline-flex',
                alignItems: 'center',
                fontWeight: 600,
              }}
            >
              <Iconify icon="solar:letter-bold" width={18} />
              tecnologia@errd.org.do
            </MuiLink>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', opacity: 0.85 }}>
              <Iconify icon="mingcute:location-fill" width={18} />
              <Typography variant="body2">República Dominicana</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', maxWidth: 320 }}>
            <Iconify icon="solar:shield-check-bold" width={32} sx={{ flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle2">
                Pago seguro · Certificado con verificación QR
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Juntos por una generación que sirve.
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
