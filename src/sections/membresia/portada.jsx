'use client';

import Link from 'next/link';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { formatearRd } from 'src/utils/planes-membresia.mjs';

import parcheOnerrd from 'src/assets/marca/parche-onerrd-2027.webp';

import { Iconify } from 'src/components/iconify';

import { TarjetaPlan } from './tarjeta-plan';
import { AvanceNacional } from './avance-nacional';
import { useConfiguracion } from './use-configuracion';
import { Pie, Encabezado, RUTA_REGISTRO } from './marca';
import { Tienda, Fogata, CertificadoIlustrado } from './ilustraciones-campamento';

// ----------------------------------------------------------------------
// LA PORTADA: qué es, cómo funciona, cuánto cuesta, qué se recibe y cómo va el
// país. Cada sección es una franja con su color suave de la paleta (azul,
// verde azulado, oro, morado, verde) para que se distingan de un vistazo; las
// ilustraciones del campamento son SVG con los mismos colores. El registro
// empieza en otra página (/registro/destacamento), en cuatro pasos.
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
    texto: 'Verás solo los planes que le corresponden a tu destacamento.',
  },
  {
    icono: 'solar:wad-of-money-bold',
    titulo: 'Paga en línea o por transferencia',
    texto: 'Con PayPal al instante, o subiendo el comprobante de tu depósito.',
  },
  {
    icono: 'solar:medal-ribbon-star-bold',
    titulo: 'Recibe tu certificado',
    texto: 'Certificado y factura oficiales, con QR verificable y por correo.',
  },
];

const DOCUMENTOS = [
  {
    icono: 'solar:medal-ribbon-star-bold',
    titulo: 'Certificado oficial con QR',
    texto: 'Con el código ONERRD 2027, tu destacamento, su región, coordinador y pastor.',
  },
  {
    icono: 'custom:invoice-duotone',
    titulo: 'Factura oficial',
    texto: 'Con el desglose de lo pagado: cuota de registro, RRI TRaC y descuento.',
  },
  {
    icono: 'solar:letter-bold',
    titulo: 'Envío por correo',
    texto: 'Los dos documentos llegan a tu correo y quedan listos para descargar.',
  },
];

const GARANTIAS = [
  { icono: 'solar:shield-check-bold', texto: 'Pago seguro' },
  { icono: 'solar:medal-star-circle-bold', texto: 'Certificado verificable' },
  { icono: 'solar:letter-bold', texto: 'Envío por correo' },
];

// El fondo suave de cada franja: el tono más claro de su familia, rebajado.
const fondoSuave =
  (color, opacidad = 0.5) =>
  (t) =>
    varAlpha(t.vars.palette[color].lighterChannel, opacidad);

function Seccion({ id, color, etiqueta, titulo, texto, children }) {
  return (
    <Box
      component="section"
      id={id}
      sx={(t) => ({
        py: { xs: 7, md: 10 },
        scrollMarginTop: 16,
        bgcolor: color ? fondoSuave(color)(t) : 'background.default',
      })}
    >
      <Container maxWidth="lg">
        <Stack
          spacing={1.5}
          sx={{ mb: { xs: 4, md: 6 }, textAlign: 'center', alignItems: 'center' }}
        >
          <Box
            sx={(t) => ({
              px: 1.5,
              py: 0.5,
              borderRadius: 5,
              typography: 'overline',
              color: `${color || 'primary'}.dark`,
              bgcolor: varAlpha(t.vars.palette[color || 'primary'].mainChannel, 0.12),
            })}
          >
            {etiqueta}
          </Box>
          <Typography variant="h3" component="h2">
            {titulo}
          </Typography>
          {texto && (
            <Typography sx={{ color: 'text.secondary', maxWidth: 640 }}>{texto}</Typography>
          )}
        </Stack>
        {children}
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------------- portada

function Hero({ vigencia }) {
  return (
    <Box
      sx={(t) => ({
        overflow: 'hidden',
        position: 'relative',
        pt: { xs: 5, md: 8 },
        pb: { xs: 7, md: 10 },
        backgroundImage: `linear-gradient(180deg, ${varAlpha(t.vars.palette.primary.lighterChannel, 0.9)} 0%, ${t.vars.palette.background.default} 100%)`,
      })}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 5, md: 6 }} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={(t) => ({
                px: 1.5,
                py: 0.75,
                borderRadius: 5,
                display: 'inline-flex',
                alignItems: 'center',
                color: 'primary.dark',
                bgcolor: 'background.paper',
                boxShadow: t.vars.customShadows?.z1,
              })}
            >
              <Iconify icon="solar:medal-star-bold" width={16} sx={{ color: 'warning.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Oficina Nacional · Exploradores del Rey
              </Typography>
            </Stack>

            <Typography
              variant="h1"
              component="h1"
              sx={{
                mt: 2.5,
                fontSize: { xs: 38, md: 56 },
                lineHeight: 1.1,
                color: 'primary.darker',
              }}
            >
              Membresía Anual{' '}
              <Box component="span" sx={{ color: 'primary.main' }}>
                2027
              </Box>
            </Typography>
            <Typography
              variant="h6"
              component="p"
              sx={{ mt: 2, fontWeight: 400, color: 'text.secondary', maxWidth: 520 }}
            >
              Registra tu destacamento, paga en línea y recibe tu certificado oficial para un año
              más de campamentos, servicio y aventura.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
              <Button
                component={Link}
                href={RUTA_REGISTRO}
                size="large"
                variant="contained"
                color="primary"
                endIcon={<Iconify icon="eva:arrow-forward-fill" />}
                sx={{ minHeight: 52, px: 3 }}
              >
                Registrar mi destacamento
              </Button>
              <Button
                component={Link}
                href="/#planes"
                size="large"
                variant="outlined"
                color="primary"
                sx={{ minHeight: 52, px: 3, bgcolor: 'background.paper' }}
              >
                Ver planes
              </Button>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 3, alignItems: 'center', color: 'text.secondary' }}
            >
              <Iconify icon="solar:calendar-date-bold" width={20} sx={{ color: 'primary.main' }} />
              <Typography variant="body2">
                Vigencia:{' '}
                <Box component="strong" sx={{ color: 'text.primary' }}>
                  {vigencia ? `${vigencia.desde} – ${vigencia.hasta}` : '…'}
                </Box>
              </Typography>
            </Stack>

            <Stack
              direction="row"
              useFlexGap
              sx={{ mt: 3, gap: { xs: 1.5, sm: 3 }, flexWrap: 'wrap' }}
            >
              {GARANTIAS.map((g) => (
                <Stack key={g.texto} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Iconify icon={g.icono} width={18} sx={{ color: 'success.main' }} />
                  <Typography variant="subtitle2">{g.texto}</Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            {/* Solo el parche del año, grande, sobre un halo suave de la paleta. */}
            <Box
              sx={{
                mx: 'auto',
                display: 'flex',
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
                width: { xs: 260, sm: 340, md: 420 },
                height: { xs: 260, sm: 340, md: 420 },
              }}
            >
              <Box
                sx={(t) => ({
                  inset: 0,
                  position: 'absolute',
                  borderRadius: '50%',
                  animation: 'haloRespira 6s ease-in-out infinite',
                  '@keyframes haloRespira': {
                    '0%, 100%': { transform: 'scale(1)', opacity: 0.9 },
                    '50%': { transform: 'scale(1.06)', opacity: 1 },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                  backgroundImage: `radial-gradient(circle, ${varAlpha(t.vars.palette.primary.lightChannel, 0.35)} 0%, ${varAlpha(t.vars.palette.primary.lighterChannel, 0.4)} 55%, transparent 72%)`,
                })}
              />
              <Box
                component="img"
                src={parcheOnerrd.src}
                alt="Parche ONERRD 2027"
                sx={{
                  position: 'relative',
                  width: { xs: 220, sm: 290, md: 360 },
                  height: { xs: 220, sm: 290, md: 360 },
                  filter: 'drop-shadow(0 24px 40px rgba(14,37,80,0.35))',
                  // El parche flota: sube y baja, y gira un poco como una moneda
                  // que se balancea (en 3D, con perspectiva).
                  animation: 'parcheFlota 6s ease-in-out infinite',
                  '@keyframes parcheFlota': {
                    '0%, 100%': {
                      transform: 'perspective(900px) translateY(0) rotateY(-10deg) rotate(-2deg)',
                    },
                    '50%': {
                      transform: 'perspective(900px) translateY(-16px) rotateY(10deg) rotate(2deg)',
                    },
                  },
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              />
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function ComoFunciona() {
  return (
    <Seccion
      id="como-funciona"
      color="info"
      etiqueta="Paso a paso"
      titulo="Cómo funciona"
      texto="Un proceso simple y seguro: en unos minutos tu destacamento queda registrado."
    >
      <Grid container spacing={3}>
        {PASOS.map((paso, i) => (
          <Grid key={paso.titulo} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                p: 3,
                height: 1,
                position: 'relative',
                transition: 'transform .2s, box-shadow .2s',
                '&:hover': { transform: 'translateY(-4px)' },
              }}
            >
              <Typography
                sx={(t) => ({
                  top: 12,
                  right: 18,
                  fontSize: 44,
                  fontWeight: 800,
                  lineHeight: 1,
                  position: 'absolute',
                  color: varAlpha(t.vars.palette.info.mainChannel, 0.16),
                })}
              >
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Box
                sx={(t) => ({
                  mb: 2.5,
                  width: 56,
                  height: 56,
                  display: 'flex',
                  borderRadius: 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'common.white',
                  backgroundImage: `linear-gradient(135deg, ${t.vars.palette.info.light}, ${t.vars.palette.info.dark})`,
                  boxShadow: `0 10px 20px -8px ${varAlpha(t.vars.palette.info.mainChannel, 0.6)}`,
                })}
              >
                <Iconify icon={paso.icono} width={28} />
              </Box>
              <Typography variant="subtitle1">{paso.titulo}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                {paso.texto}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Seccion>
  );
}

function Planes({ planes }) {
  const soloRegistro = planes?.find((p) => p.id === 'solo_registro');
  return (
    <Seccion
      id="planes"
      color="warning"
      etiqueta="Precios 2027"
      titulo="Planes de membresía"
      texto="El sistema determina automáticamente qué planes le corresponden a tu destacamento."
    >
      <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
        {!planes &&
          [0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={190} />
            </Grid>
          ))}
        {planes?.map((plan) => (
          <Grid key={plan.id} size={{ xs: 12, md: 12 / Math.min(3, planes.length || 1) }}>
            <Card sx={{ height: 1 }}>
              <TarjetaPlan plan={plan} />
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card
        sx={{
          mt: 3,
          p: { xs: 2.5, md: 3 },
          gap: 3,
          display: 'flex',
          alignItems: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Tienda tamano={170} sx={{ flexShrink: 0 }} />
        <Box>
          <Typography variant="subtitle1">¿Qué es RRI TRaC?</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Es la plataforma digital de registro, control y capacitación de los miembros de tu
            destacamento.
            {soloRegistro &&
              ` La cuota de ${formatearRd(soloRegistro.precio)} sin RRI TRaC es solo para los destacamentos que ya tienen una licencia activa.`}
          </Typography>
        </Box>
      </Card>
    </Seccion>
  );
}

function Documentos() {
  return (
    <Seccion
      color="secondary"
      etiqueta="Al confirmar tu pago"
      titulo="Documentos que recibirás"
      texto="Verificables en línea escaneando su código QR."
    >
      <Grid container spacing={{ xs: 4, md: 6 }} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <CertificadoIlustrado tamano={420} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            {DOCUMENTOS.map((d) => (
              <Card
                key={d.titulo}
                sx={{ p: 2.5, gap: 2, display: 'flex', alignItems: 'flex-start' }}
              >
                <Box
                  sx={(t) => ({
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    display: 'flex',
                    borderRadius: 1.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'secondary.main',
                    bgcolor: varAlpha(t.vars.palette.secondary.mainChannel, 0.1),
                  })}
                >
                  <Iconify icon={d.icono} width={26} />
                </Box>
                <Box>
                  <Typography variant="subtitle1">{d.titulo}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {d.texto}
                  </Typography>
                </Box>
              </Card>
            ))}
          </Stack>
        </Grid>
      </Grid>
    </Seccion>
  );
}

function Avance() {
  return (
    <Seccion
      id="avance"
      color="success"
      etiqueta="En vivo"
      titulo="Avance nacional"
      texto="Membresías 2027 registradas por región."
    >
      <AvanceNacional />
    </Seccion>
  );
}

function Llamado() {
  return (
    <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box
          sx={(t) => ({
            px: { xs: 3, md: 6 },
            py: { xs: 4, md: 5 },
            gap: 3,
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 4,
            alignItems: 'center',
            color: 'common.white',
            flexDirection: { xs: 'column', md: 'row' },
            textAlign: { xs: 'center', md: 'left' },
            backgroundImage: `linear-gradient(120deg, ${t.vars.palette.brand.navy} 0%, ${t.vars.palette.primary.dark} 100%)`,
          })}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h3" component="h2">
              ¿Listo para la temporada 2027?
            </Typography>
            <Typography sx={{ mt: 1, opacity: 0.8, maxWidth: 520 }}>
              Toma unos minutos. Si pagarás por transferencia, ten a mano el comprobante del
              depósito.
            </Typography>
            <Button
              component={Link}
              href={RUTA_REGISTRO}
              size="large"
              variant="contained"
              color="inherit"
              endIcon={<Iconify icon="eva:arrow-forward-fill" />}
              sx={{ mt: 3, minHeight: 52, px: 3, color: 'primary.darker', bgcolor: 'common.white' }}
            >
              Comenzar registro
            </Button>
          </Box>
          <Fogata tamano={240} sx={{ flexShrink: 0, mb: { md: -5 } }} />
        </Box>
      </Container>
    </Box>
  );
}

export function Portada() {
  // Planes, montos y vigencia: los que la Oficina Nacional guardó en el dashboard.
  const configuracion = useConfiguracion();
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Encabezado />
      <Hero vigencia={configuracion?.vigencia} />
      <ComoFunciona />
      <Planes planes={configuracion?.planes} />
      <Documentos />
      <Avance />
      <Llamado />
      <Pie />
    </Box>
  );
}
