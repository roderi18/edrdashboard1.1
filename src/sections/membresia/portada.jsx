'use client';

import Link from 'next/link';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { formatearRd } from 'src/utils/planes-membresia.mjs';

import { Iconify } from 'src/components/iconify';

import { TarjetaPlan } from './tarjeta-plan';
import { AvanceNacional } from './avance-nacional';
import { useConfiguracion } from './use-configuracion';
import { Pie, Encabezado, RUTA_REGISTRO } from './marca';

// ----------------------------------------------------------------------
// LA PORTADA: qué es, cómo funciona, cuánto cuesta y cómo va el país. El
// registro empieza en otra página (/registro/destacamento), en cuatro pasos.
// ----------------------------------------------------------------------

const PASOS = [
  {
    icono: 'eva:search-fill',
    titulo: 'Selecciona tu destacamento',
    texto: 'Búscalo por número o nombre en el censo oficial.',
  },
  {
    icono: 'solar:bill-list-bold',
    titulo: 'Elige tu plan',
    texto: 'El sistema muestra los planes que le corresponden a tu destacamento.',
  },
  {
    icono: 'solar:wad-of-money-bold',
    titulo: 'Paga con PayPal o transferencia',
    texto: 'En línea, o subiendo el comprobante de tu depósito.',
  },
  {
    icono: 'solar:medal-ribbon-star-bold',
    titulo: 'Recibe tu certificado y factura',
    texto: 'Al confirmarse el pago, con QR verificable y por correo.',
  },
];

function Titulo({ id, children, derecha }) {
  return (
    <Stack
      id={id}
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        mb: 3,
        scrollMarginTop: 24,
        justifyContent: 'space-between',
        alignItems: { sm: 'flex-end' },
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Typography variant="h4" component="h2">
          {children}
        </Typography>
        <Box
          sx={{
            width: 32,
            height: 3,
            borderRadius: 1,
            bgcolor: 'primary.main',
          }}
        />
      </Stack>
      {derecha && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {derecha}
        </Typography>
      )}
    </Stack>
  );
}

function Hero({ vigencia }) {
  return (
    <Box
      sx={(t) => ({
        color: 'common.white',
        overflow: 'hidden',
        position: 'relative',
        py: { xs: 5, md: 7 },
        backgroundImage: `linear-gradient(120deg, ${t.vars.palette.primary.darker} 0%, ${t.vars.palette.primary.dark} 60%, ${t.vars.palette.primary.main} 100%)`,
      })}
    >
      <Container maxWidth="xl">
        <Grid container spacing={4} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1.5 }}>
              Oficina Nacional de Exploradores del Rey
            </Typography>
            <Typography variant="h1" component="h1" sx={{ mt: 1, fontSize: { xs: 36, md: 52 } }}>
              Membresía Anual 2027
            </Typography>
            <Typography variant="h5" component="p" sx={{ mt: 2, fontWeight: 400, opacity: 0.92 }}>
              Registra tu destacamento, paga en línea y recibe tu certificado oficial.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                mt: 3,
                px: 2,
                py: 1,
                borderRadius: 1.5,
                display: 'inline-flex',
                alignItems: 'center',
                color: 'primary.darker',
                bgcolor: 'common.white',
              }}
            >
              <Iconify icon="solar:calendar-date-bold" />
              <Typography variant="subtitle2">
                Vigencia: {vigencia ? `${vigencia.desde} – ${vigencia.hasta}` : '…'}
              </Typography>
            </Stack>
            <Box sx={{ mt: 4 }}>
              <Button
                component={Link}
                href={RUTA_REGISTRO}
                size="large"
                variant="contained"
                color="info"
                endIcon={<Iconify icon="eva:arrow-forward-fill" />}
              >
                Registrar mi destacamento
              </Button>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack
              direction="row"
              spacing={3}
              sx={{ alignItems: 'center', justifyContent: 'center' }}
            >
              <Box
                component="img"
                src="/marca/parche-onerrd-2027.webp"
                alt="Parche ONERRD 2027"
                sx={{
                  width: { xs: 200, md: 280 },
                  height: { xs: 200, md: 280 },
                  filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.35))',
                }}
              />
              <Box
                component="img"
                src="/marca/logo-oficina-nacional.webp"
                alt="Oficina Nacional de Exploradores del Rey"
                sx={{
                  width: 200,
                  height: 200,
                  display: { xs: 'none', lg: 'block' },
                }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function ComoFunciona() {
  return (
    <Box component="section">
      <Titulo id="como-funciona" derecha="Un proceso simple y seguro">
        Cómo funciona
      </Titulo>
      <Grid container spacing={2}>
        {PASOS.map((paso, i) => (
          <Grid key={paso.titulo} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ p: 2.5, height: 1 }}>
              <Stack direction="row" spacing={2}>
                <Box
                  sx={(t) => ({
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    display: 'flex',
                    borderRadius: '50%',
                    position: 'relative',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.main',
                    bgcolor: varAlpha(t.vars.palette.primary.mainChannel, 0.08),
                  })}
                >
                  <Iconify icon={paso.icono} width={24} />
                  <Box
                    sx={{
                      top: -6,
                      left: -6,
                      width: 22,
                      height: 22,
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      borderRadius: '50%',
                      position: 'absolute',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'common.white',
                      bgcolor: 'primary.main',
                    }}
                  >
                    {i + 1}
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2">{paso.titulo}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {paso.texto}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function Planes({ planes }) {
  const soloRegistro = planes?.find((p) => p.id === 'solo_registro');
  return (
    <Box component="section">
      <Titulo
        id="planes"
        derecha="El sistema determina automáticamente qué planes te corresponden."
      >
        Planes de membresía 2027
      </Titulo>
      <Grid container spacing={2}>
        {!planes &&
          [0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={170} />
            </Grid>
          ))}
        {planes?.map((plan) => (
          <Grid key={plan.id} size={{ xs: 12, md: 12 / Math.min(3, planes.length || 1) }}>
            <TarjetaPlan plan={plan} />
          </Grid>
        ))}
      </Grid>
      <Alert severity="info" sx={{ mt: 2 }}>
        <strong>RRI TRaC</strong> es la plataforma digital de registro, control y capacitación de
        miembros.
        {soloRegistro &&
          ` La cuota de ${formatearRd(soloRegistro.precio)} sin RRI TRaC es solo para los destacamentos que ya tienen una licencia activa.`}
      </Alert>
    </Box>
  );
}

const DOCUMENTOS = [
  {
    icono: 'solar:medal-ribbon-star-bold',
    titulo: 'Certificado oficial con QR',
    texto: 'Con el código ONERRD 2027, tu destacamento, su jurisdicción, coordinador y pastor.',
  },
  {
    icono: 'custom:invoice-duotone',
    titulo: 'Factura oficial',
    texto: 'Con el desglose de lo pagado: cuota de registro, RRI TRaC y descuento.',
  },
  {
    icono: 'solar:letter-bold',
    titulo: 'Envío por correo',
    texto: 'Los dos documentos llegan al correo que indiques y quedan para descargar.',
  },
];

function Documentos() {
  return (
    <Box component="section">
      <Titulo derecha="Verificables en línea escaneando el QR">Documentos que recibirás</Titulo>
      <Grid container spacing={2}>
        {DOCUMENTOS.map((d) => (
          <Grid key={d.titulo} size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ p: 2.5, height: 1 }}>
              <Iconify icon={d.icono} width={36} sx={{ color: 'primary.main', mb: 1.5 }} />
              <Typography variant="subtitle1">{d.titulo}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {d.texto}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export function Portada() {
  // Planes, montos y vigencia: los que la Oficina Nacional guardó en el dashboard.
  const configuracion = useConfiguracion();
  return (
    <Box
      sx={{
        bgcolor: 'background.neutral',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Encabezado />
      <Hero vigencia={configuracion?.vigencia} />
      <Container maxWidth="lg" sx={{ mb: { xs: 5, md: 8 } }}>
        <Stack spacing={{ xs: 5, md: 7 }} sx={{ mt: { xs: 5, md: 7 } }} divider={<Divider />}>
          <ComoFunciona />
          <Planes planes={configuracion?.planes} />
          <Documentos />
          <Box component="section">
            <Titulo id="avance" derecha="Membresías registradas por región · 2027">
              Avance nacional
            </Titulo>
            <AvanceNacional />
          </Box>
          <Card
            sx={(t) => ({
              p: { xs: 3, md: 4 },
              color: 'common.white',
              textAlign: 'center',
              backgroundImage: `linear-gradient(120deg, ${t.vars.palette.primary.darker}, ${t.vars.palette.primary.dark})`,
            })}
          >
            <Typography variant="h4">¿Listo para registrar tu destacamento?</Typography>
            <Typography sx={{ mt: 1, opacity: 0.85 }}>
              Toma unos minutos. Ten a mano el comprobante si pagarás por transferencia.
            </Typography>
            <Button
              component={Link}
              href={RUTA_REGISTRO}
              size="large"
              variant="contained"
              color="info"
              endIcon={<Iconify icon="eva:arrow-forward-fill" />}
              sx={{ mt: 3 }}
            >
              Comenzar registro
            </Button>
          </Card>
        </Stack>
      </Container>
      <Pie />
    </Box>
  );
}
