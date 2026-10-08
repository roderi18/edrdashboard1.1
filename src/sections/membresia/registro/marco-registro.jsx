'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import MuiLink from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import {
  aDolares,
  formatearRd,
  formatearUsd,
  CUOTA_REGISTRO,
  PRECIO_RRI_TRAC,
} from 'src/utils/planes-membresia.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { Pie, Encabezado } from '../marca';
import { PASOS, useRegistro, ProveedorRegistro, nombreDeDestacamento } from './contexto-registro';

// ----------------------------------------------------------------------
// EL MARCO DE LOS CUATRO PASOS: a la izquierda los pasos, en el centro la
// página del paso y a la derecha el resumen del pedido. En el móvil, los pasos
// se vuelven una barra arriba y el resumen baja al final.
// ----------------------------------------------------------------------

const indiceDePaso = (ruta) => {
  const i = PASOS.findIndex((p) => ruta?.startsWith(p.ruta.replace(/\/$/, '')));
  return i < 0 ? 0 : i;
};

function PasosLaterales({ actual }) {
  return (
    <Card
      sx={(t) => ({
        p: 3,
        top: 24,
        position: 'sticky',
        color: 'common.white',
        display: { xs: 'none', lg: 'block' },
        backgroundImage: `linear-gradient(180deg, ${t.vars.palette.primary.darker}, ${t.vars.palette.primary.dark})`,
      })}
    >
      <Typography variant="h5">Pasos de registro</Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5, mb: 3 }}>
        Completa los 4 pasos para activar tu membresía 2027.
      </Typography>
      <Stack spacing={1}>
        {PASOS.map((paso, i) => {
          const activo = i === actual;
          const hecho = i < actual;
          return (
            <Stack
              key={paso.id}
              direction="row"
              spacing={1.5}
              sx={(t) => ({
                p: 1.5,
                borderRadius: 1.5,
                alignItems: 'center',
                opacity: activo || hecho ? 1 : 0.7,
                bgcolor: activo
                  ? varAlpha(t.vars.palette.common.whiteChannel, 0.14)
                  : 'transparent',
              })}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  display: 'flex',
                  borderRadius: '50%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: hecho ? 'common.white' : 'primary.darker',
                  bgcolor: hecho ? 'success.main' : 'common.white',
                }}
              >
                {hecho ? <Iconify icon="eva:checkmark-fill" width={20} /> : i + 1}
              </Box>
              <Box>
                <Typography variant="subtitle2">{paso.titulo}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {paso.texto}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}

function PasosMovil({ actual }) {
  const paso = PASOS[actual];
  return (
    <Card variant="outlined" sx={{ p: 2, display: { lg: 'none' } }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">
          Paso {actual + 1} de {PASOS.length} · {paso.titulo}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {Math.round(((actual + 1) / PASOS.length) * 100)}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={((actual + 1) / PASOS.length) * 100}
        sx={{ height: 6, borderRadius: 1 }}
      />
    </Card>
  );
}

function Fila({ titulo, valor, fuerte, editar }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {titulo}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', textAlign: 'right' }}>
        <Typography variant={fuerte ? 'subtitle2' : 'body2'}>{valor}</Typography>
        {editar && (
          <MuiLink component={Link} href={editar} aria-label={`Cambiar ${titulo.toLowerCase()}`}>
            <Iconify icon="solar:pen-bold" width={16} />
          </MuiLink>
        )}
      </Stack>
    </Stack>
  );
}

function ResumenPedido({ actual }) {
  const { elegibilidad, plan, configuracion, solicitud } = useRegistro();

  // En "Resultado" manda lo que se envió; antes, lo que se va eligiendo.
  const enviado = actual === 3 && solicitud;
  const destacamento = enviado ? solicitud.destacamento : elegibilidad?.destacamento;
  const p = enviado ? solicitud.plan : plan;
  const editable = actual < 3;
  const tasa = configuracion?.rate;
  const usd = enviado ? solicitud.montoUsd : p && aDolares(p.precio, tasa);

  return (
    <Card sx={{ p: 3, top: 24, position: { lg: 'sticky' } }}>
      <Typography variant="h6">Resumen del pedido</Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1.5}>
        <Fila
          titulo="Destacamento"
          valor={destacamento ? nombreDeDestacamento(destacamento) : '—'}
          editar={editable && actual > 0 && destacamento ? '/registro/destacamento/' : null}
        />
        <Fila
          titulo="Plan elegido"
          valor={p?.nombre || 'Pendiente de selección'}
          editar={editable && actual > 1 && p ? '/registro/plan/' : null}
        />
        {p?.descuento > 0 && (
          <Box sx={{ textAlign: 'right' }}>
            <Label color="info">Descuento por fidelidad</Label>
          </Box>
        )}
        {enviado && solicitud.codigo && <Fila titulo="Código" valor={solicitud.codigo} fuerte />}
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1.5}>
        <Fila
          titulo="Cuota de registro"
          valor={
            p
              ? formatearRd(p.cuotaRegistro ?? CUOTA_REGISTRO, {
                  decimales: true,
                })
              : '—'
          }
        />
        <Fila
          titulo="RRI TRaC"
          valor={
            p
              ? p.rriTrac
                ? formatearRd(p.rriTrac ?? PRECIO_RRI_TRAC, { decimales: true })
                : 'No incluido'
              : '—'
          }
        />
        <Fila
          titulo="Descuento"
          valor={
            p
              ? p.descuento
                ? `− ${formatearRd(p.descuento, { decimales: true })}`
                : formatearRd(0, { decimales: true })
              : '—'
          }
        />
      </Stack>
      <Box
        sx={(t) => ({
          mt: 2,
          p: 2,
          borderRadius: 1.5,
          bgcolor: varAlpha(t.vars.palette.primary.mainChannel, 0.08),
        })}
      >
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {enviado && solicitud.estado === 'confirmada' ? 'Total pagado' : 'Total'}
          </Typography>
          <Typography variant="h5" sx={{ color: 'primary.main' }}>
            {p ? formatearRd(p.precio, { decimales: true }) : '—'}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          component="p"
          sx={{ color: 'text.secondary', textAlign: 'right' }}
        >
          Equivalente en USD: {usd ? formatearUsd(usd) : '—'}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 2, justifyContent: 'center', color: 'text.secondary' }}
      >
        <Iconify icon="solar:lock-password-outline" width={16} />
        <Typography variant="caption">Pago seguro · Tus datos están protegidos.</Typography>
      </Stack>
    </Card>
  );
}

function Marco({ children }) {
  const actual = indiceDePaso(usePathname());
  return (
    <Box sx={{ bgcolor: 'background.neutral', minHeight: '100vh' }}>
      <Encabezado conBoton={false} />
      <Container maxWidth="xl" sx={{ mt: { xs: 3, md: 4 } }}>
        <Box
          sx={{
            gap: 3,
            display: 'grid',
            alignItems: 'start',
            gridTemplateColumns: {
              xs: '1fr',
              lg: '280px minmax(0, 1fr) 340px',
            },
          }}
        >
          <PasosLaterales actual={actual} />
          <Stack spacing={3} sx={{ minWidth: 0 }}>
            <PasosMovil actual={actual} />
            {children}
          </Stack>
          <ResumenPedido actual={actual} />
        </Box>
      </Container>
      <Pie />
    </Box>
  );
}

export function MarcoRegistro({ children }) {
  return (
    <ProveedorRegistro>
      <Marco>{children}</Marco>
    </ProveedorRegistro>
  );
}

// La cabecera de cada paso: "PASO 2 DE 4", título, explicación y avance.
export function CabeceraPaso({ indice, titulo, texto }) {
  const avance = ((indice + 1) / PASOS.length) * 100;
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ justifyContent: 'space-between', mb: 3 }}
    >
      <Box>
        <Typography variant="overline" sx={{ color: 'primary.main' }}>
          Paso {indice + 1} de {PASOS.length}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 26, md: 32 } }}>
          {titulo}
        </Typography>
        {texto && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{texto}</Typography>}
      </Box>
      <Stack spacing={0.75} sx={{ minWidth: 200, display: { xs: 'none', lg: 'flex' } }}>
        <Typography variant="caption" sx={{ textAlign: 'right' }}>
          <strong>{Math.round(avance)}%</strong> completado
        </Typography>
        <LinearProgress variant="determinate" value={avance} sx={{ height: 8, borderRadius: 1 }} />
      </Stack>
    </Stack>
  );
}
