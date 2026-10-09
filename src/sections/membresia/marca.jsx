'use client';

import Link from 'next/link';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';

import logoOficina from 'src/assets/marca/logo-oficina-nacional.webp';

import { Iconify } from 'src/components/iconify';

import { BotonExplorarDeNoche } from './explorar-de-noche';

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
        src={logoOficina.src}
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
            <BotonExplorarDeNoche />
            <BotonModo />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

// CLARO U OSCURO, a la derecha de los enlaces. De entrada sigue al del sistema;
// pulsarlo lo fija (se guarda en el navegador) hasta volver al del sistema.
function BotonModo() {
  const { colorScheme, systemMode, setMode } = useColorScheme();
  const oscuro = colorScheme === 'dark';
  const texto = oscuro ? 'Modo claro' : 'Modo oscuro';
  return (
    <Tooltip title={texto}>
      <IconButton
        aria-label={texto}
        onClick={() => {
          // Si lo elegido coincide con el del sistema, vuelve a seguir al
          // sistema (cambia solo cuando cambie el del teléfono o la PC).
          const elegido = oscuro ? 'light' : 'dark';
          setMode(elegido === systemMode ? 'system' : elegido);
        }}
        sx={(t) => ({
          color: 'common.white',
          border: `1px solid ${varAlpha(t.vars.palette.common.whiteChannel, 0.3)}`,
          '&:hover': { bgcolor: varAlpha(t.vars.palette.common.whiteChannel, 0.12) },
        })}
      >
        <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: 20, height: 20 }}>
          {oscuro ? (
            // Sol: para volver a claro.
            <g fill="currentColor">
              <circle cx={12} cy={12} r={4.5} />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((g) => (
                <rect
                  key={g}
                  x={11}
                  y={1.5}
                  width={2}
                  height={3.5}
                  rx={1}
                  transform={`rotate(${g} 12 12)`}
                />
              ))}
            </g>
          ) : (
            // Luna: para pasar a oscuro.
            <path
              fill="currentColor"
              d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"
            />
          )}
        </Box>
      </IconButton>
    </Tooltip>
  );
}

export function Pie() {
  return (
    <Box
      component="footer"
      sx={(t) => ({
        // Siempre abajo: el contenedor es una columna de toda la altura.
        mt: 'auto',
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
              oficinanacional@errd.org.do
            </MuiLink>
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', maxWidth: 320 }}>
            <Iconify icon="solar:shield-check-bold" width={32} sx={{ flexShrink: 0 }} />
            <Box>
              <Typography variant="subtitle2">
                Pago seguro · Certificado con verificación QR
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Evangelizar, equipar y empoderar a la próxima generación.
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
