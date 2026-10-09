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

import { aDolares, formatearRd, formatearUsd } from 'src/utils/planes-membresia.mjs';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

import { Pie, Encabezado } from '../marca';
import { planConTextoClaro } from '../tarjeta-plan';
import { Banderita, PaisajeFondo, CieloNocturno } from '../ilustraciones-campamento';
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

// El tramo de sendero de tierra (punteado, en oro) que une un paso con el
// siguiente, con una curva suave como un camino de campamento.
function Sendero() {
  return (
    <Box
      component="svg"
      viewBox="0 0 36 28"
      aria-hidden
      sx={(t) => ({
        width: 36,
        height: 28,
        display: 'block',
        ml: 1.5,
        my: -0.5,
        color: t.vars.palette.brand.oroLight,
      })}
    >
      <path
        d="M18,0 C8,9 28,18 18,28"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="1.5 6"
      />
    </Box>
  );
}

function PasosLaterales({ actual }) {
  return (
    <Card
      sx={(t) => ({
        p: 3,
        top: 24,
        position: 'sticky',
        color: 'common.white',
        display: { xs: 'none', lg: 'block' },
        backgroundImage: `linear-gradient(180deg, ${t.vars.palette.primary.dark}, ${t.vars.palette.primary.darker})`,
      })}
    >
      <Typography variant="h5">Pasos de registro</Typography>
      <Typography variant="body2" sx={{ opacity: 0.8, mt: 0.5, mb: 3 }}>
        Completa los 4 pasos para activar tu membresía 2027.
      </Typography>
      <Box>
        {PASOS.map((paso, i) => {
          const activo = i === actual;
          const hecho = i < actual;
          return (
            <Box key={paso.id}>
              <Stack
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
                  sx={(t) => ({
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    display: 'flex',
                    borderRadius: '50%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: hecho ? 'common.white' : 'primary.darker',
                    bgcolor: hecho
                      ? 'success.main'
                      : activo
                        ? t.vars.palette.brand.oroLighter
                        : 'common.white',
                  })}
                >
                  {hecho ? (
                    <Iconify icon="eva:checkmark-fill" width={20} />
                  ) : activo ? (
                    <Banderita tamano={22} />
                  ) : (
                    i + 1
                  )}
                </Box>
                <Box>
                  <Typography variant="subtitle2">{paso.titulo}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {paso.texto}
                  </Typography>
                </Box>
              </Stack>
              {i < PASOS.length - 1 && <Sendero />}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

function PasosMovil({ actual }) {
  const paso = PASOS[actual];
  return (
    <Card variant="outlined" sx={{ p: 2, display: { lg: 'none' } }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <Banderita tamano={20} />
        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
          Paso {actual + 1} de {PASOS.length} · {paso.titulo}
        </Typography>
      </Stack>
      {/* El avance como un sendero: un tramo por paso, lleno hasta el actual. */}
      <Stack direction="row" spacing={0.75}>
        {PASOS.map((p, i) => (
          <Box
            key={p.id}
            sx={(t) => ({
              flex: 1,
              height: 6,
              borderRadius: 3,
              bgcolor:
                i <= actual
                  ? i === actual
                    ? t.vars.palette.primary.main
                    : t.vars.palette.primary.light
                  : varAlpha(t.vars.palette.grey['500Channel'], 0.2),
            })}
          />
        ))}
      </Stack>
    </Card>
  );
}

// La tarjeta de cada paso: como un parche bordado, con una cinta tejida arriba
// (en azules de la casa) y el contenido del paso dentro.
export function TarjetaPaso({ children }) {
  return (
    <Card
      sx={(t) => ({
        p: { xs: 2.5, md: 4 },
        pt: { xs: 3.5, md: 5 },
        position: 'relative',
        '&::before': {
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          content: '""',
          position: 'absolute',
          backgroundImage: `repeating-linear-gradient(-45deg, ${t.vars.palette.primary.main} 0 10px, ${t.vars.palette.primary.dark} 10px 20px, ${t.vars.palette.primary.light} 20px 30px)`,
        },
      })}
    >
      {children}
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
  const { elegibilidad, plan, configuracion, solicitud, correcciones, registradoPor } =
    useRegistro();

  // En "Resultado" manda lo que se envió; antes, lo que se va eligiendo.
  const enviado = actual === 3 && solicitud;
  // Con los datos corregidos a la vista: son los que revisará la Oficina Nacional.
  const destacamento = enviado
    ? solicitud.destacamento
    : elegibilidad?.destacamento && { ...elegibilidad.destacamento, ...correcciones };
  const corregido = enviado
    ? Object.keys(solicitud.correcciones || {}).length > 0
    : Object.keys(correcciones || {}).length > 0;
  // El plan y su precio se enseñan desde el paso 2: en el 1 aún no se elige.
  const p = enviado ? solicitud.plan : actual > 0 ? plan : null;
  const editable = actual < 3;
  const tasa = configuracion?.rate;
  const usd = enviado ? solicitud.montoUsd : p && aDolares(p.precio, tasa);

  return (
    <Card sx={{ p: 3, top: 24, position: { lg: 'sticky' } }}>
      {/* El título como la etiqueta de una mochila: cinta verde con su ojal. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          ml: -3,
          pl: 3,
          pr: 4,
          py: 1,
          width: 'fit-content',
          alignItems: 'center',
          color: 'common.white',
          bgcolor: 'primary.dark',
          clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)',
        }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'common.white' }} />
        <Typography variant="h6">Resumen del pedido</Typography>
      </Stack>
      <Divider sx={{ my: 2, borderStyle: 'dashed', borderColor: 'transparent' }} />
      <Stack spacing={1.5}>
        <Fila
          titulo="Destacamento"
          valor={destacamento ? nombreDeDestacamento(destacamento) : '—'}
          editar={editable && actual > 0 && destacamento ? '/registro/destacamento/' : null}
        />
        {!enviado && registradoPor?.nombre?.trim() && (
          <Fila titulo="Registrado por" valor={registradoPor.nombre.trim()} />
        )}
        <Fila
          titulo="Opción"
          valor={p ? planConTextoClaro(p).nombre : 'Se muestra en el paso 2'}
          editar={editable && actual > 1 && p ? '/registro/plan/' : null}
        />
        {corregido && (
          <Box sx={{ textAlign: 'right' }}>
            <Label color="info">Datos corregidos · en revisión</Label>
          </Box>
        )}
        {p?.descuento > 0 && (
          <Box sx={{ textAlign: 'right' }}>
            <Label color="info">Descuento por fidelidad</Label>
          </Box>
        )}
        {enviado && solicitud.codigo && <Fila titulo="Código" valor={solicitud.codigo} fuerte />}
      </Stack>
      <Divider
        sx={(t) => ({ my: 2, borderStyle: 'dashed', borderColor: t.vars.palette.primary.light })}
      />
      <Stack spacing={1.5}>
        <Fila
          titulo="Cuota de registro"
          valor={
            p
              ? formatearRd(p.cuotaRegistro, {
                  decimales: true,
                })
              : '—'
          }
        />
        <Fila
          titulo="RRI TRaC"
          valor={
            p ? (p.rriTrac ? formatearRd(p.rriTrac, { decimales: true }) : 'No incluido') : '—'
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
          color: t.vars.palette.primary.darker,
          bgcolor: t.vars.palette.primary.lighter,
          border: `1.5px solid ${t.vars.palette.primary.light}`,
        })}
      >
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {enviado && solicitud.estado === 'confirmada' ? 'Total pagado' : 'Total'}
          </Typography>
          <Typography variant="h5">
            {p ? formatearRd(p.precio, { decimales: true }) : '—'}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          component="p"
          sx={(t) => ({ color: t.vars.palette.primary.dark, textAlign: 'right' })}
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
    <Box
      sx={(t) => ({
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        flexDirection: 'column',
        // Cielo claro arriba que baja a verde de pradera.
        backgroundImage: `linear-gradient(180deg, ${varAlpha(t.vars.palette.primary.lighterChannel, 0.7)} 0%, ${varAlpha(t.vars.palette.success.lighterChannel, 0.55)} 100%)`,
        ...t.applyStyles('dark', {
          bgcolor: 'background.default',
          backgroundImage: `linear-gradient(180deg, ${varAlpha(t.vars.palette.primary.mainChannel, 0.16)} 0%, ${varAlpha(t.vars.palette.success.mainChannel, 0.08)} 100%)`,
        }),
      })}
    >
      <Encabezado conBoton={false} />
      {/* El contenido crece y, detrás, al fondo de esa zona (justo encima del pie),
          montañas, colinas y pinos. */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <Box aria-hidden sx={{ inset: 0, zIndex: 0, position: 'absolute', pointerEvents: 'none' }}>
          <CieloNocturno />
        </Box>
        <Box
          aria-hidden
          sx={{
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            aspectRatio: '1600 / 370',
            minHeight: 140,
            position: 'absolute',
            pointerEvents: 'none',
          }}
        >
          <PaisajeFondo />
        </Box>
        <Container
          maxWidth="xl"
          sx={{
            zIndex: 1,
            position: 'relative',
            pt: { xs: 3, md: 4 },
            pb: { xs: 16, md: 26 },
          }}
        >
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
      </Box>
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
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ justifyContent: 'space-between', mb: 3 }}
    >
      <Box>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 26, md: 32 } }}>
          {titulo}
        </Typography>
        {texto && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{texto}</Typography>}
      </Box>
      {/* A la derecha, donde iba la barra de porcentaje. */}
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          px: 1.25,
          py: 0.5,
          height: 'fit-content',
          borderRadius: 5,
          flexShrink: 0,
          width: 'fit-content',
          alignItems: 'center',
          order: { md: 2 },
          color: 'primary.dark',
          bgcolor: 'primary.lighter',
        }}
      >
        <Banderita tamano={16} color="currentColor" />
        <Typography variant="overline" sx={{ whiteSpace: 'nowrap', lineHeight: 1.6 }}>
          Paso {indice + 1} de {PASOS.length}
        </Typography>
      </Stack>
    </Stack>
  );
}
