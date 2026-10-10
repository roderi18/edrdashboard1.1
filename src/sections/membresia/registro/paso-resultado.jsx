'use client';

import { varAlpha } from 'minimal-shared/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { PASOS, useRegistro } from './contexto-registro';
import { TarjetaPaso, CabeceraPaso } from './marco-registro';
import {
  Tienda,
  Fogata,
  Brujula,
  Mochila,
  CertificadoIlustrado,
} from '../ilustraciones-campamento';

// ----------------------------------------------------------------------
// PASO 4 · EL RESULTADO. Se lee del servidor con el enlace de la solicitud
// (?solicitud=…), el mismo que llega por correo: sirve aunque se cierre el
// navegador. Cuatro estados: confirmada (código y documentos), pendiente de
// validación (transferencia), pendiente de PayPal y rechazada (con el motivo).
// ----------------------------------------------------------------------

const NOMBRES_CAMPOS = {
  numero: 'Número oficial',
  nombre: 'Nombre',
  region: 'Región',
  seccion: 'Sección',
  iglesia: 'Iglesia',
  coordinador: 'Coordinador(a)',
  pastor: 'Pastor(a)',
};

const ESTADOS = {
  confirmada: {
    color: 'success',
    icono: 'solar:check-circle-bold',
    titulo: 'Pago confirmado',
    texto:
      'Tu membresía 2027 está activa. Descarga tu certificado y tu factura; también te los enviamos por correo.',
  },
  pendiente_transferencia: {
    color: 'warning',
    icono: 'solar:clock-circle-bold',
    titulo: 'Depósito pendiente de validación',
    texto:
      'La Oficina Nacional está validando tu comprobante. Al aprobarlo, recibirás por correo el certificado y la factura con tu código ONERRD 2027.',
  },
  pendiente_paypal: {
    color: 'info',
    icono: 'solar:clock-circle-bold',
    titulo: 'Esperando la confirmación de PayPal',
    texto:
      'En cuanto PayPal confirme el cobro, tu membresía quedará activa. Esta página se actualiza sola.',
  },
  pendiente_revision: {
    color: 'warning',
    icono: 'solar:clock-circle-bold',
    titulo: 'Pago recibido · en revisión',
    texto:
      'Recibimos tu pago. Como corregiste datos del destacamento, la Oficina Nacional los revisará antes de activar la membresía. Te avisaremos por correo y recibirás el certificado y la factura con los datos correctos.',
  },
  rechazada: {
    color: 'error',
    icono: 'solar:close-circle-bold',
    titulo: 'Depósito rechazado',
    texto: 'La Oficina Nacional no pudo validar tu comprobante. Puedes volver a registrar el pago.',
  },
};

function Documento({ icono, titulo, href }) {
  return (
    <Card variant="outlined" sx={{ p: 2.5, textAlign: 'center', height: 1 }}>
      <Iconify icon={icono} width={48} sx={{ color: 'primary.main', mb: 1 }} />
      <Typography variant="subtitle1">{titulo}</Typography>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 2 }}>
        PDF verificable en línea con su QR
      </Typography>
      <Button href={href} variant="contained" startIcon={<Iconify icon="solar:download-bold" />}>
        Descargar
      </Button>
    </Card>
  );
}

// La escena de cada estado: la tienda con luciérnagas mientras se espera, la
// fogata mientras se generan los documentos, el certificado cuando están listos
// y la tienda apagada (en gris) si se rechazó.
function Escena({ estado, generando, listos }) {
  if (estado === 'confirmada' && listos) return <CertificadoIlustrado tamano={170} />;
  if (estado === 'confirmada' || generando) return <Fogata tamano={130} />;
  if (estado === 'rechazada')
    return <Tienda tamano={170} sx={{ filter: 'grayscale(1)', opacity: 0.6 }} />;
  return <Tienda tamano={170} />;
}

export function PasoResultado() {
  const router = useRouter();
  const parametros = useSearchParams();
  const token = parametros.get('solicitud');
  const errorPaypal = parametros.get('paypal') === 'error';
  const { setSolicitud, reiniciar } = useRegistro();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  const leer = useCallback(() => {
    if (!token) return Promise.resolve();
    return fetch(`/api/solicitudes/${encodeURIComponent(token)}/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        setDatos(d);
        setSolicitud(d);
      })
      .catch(() =>
        setError('No encontramos esta solicitud. Revisa el enlace que recibiste por correo.')
      );
  }, [token, setSolicitud]);

  useEffect(() => {
    leer();
    return () => setSolicitud(null);
  }, [leer, setSolicitud]);

  // PayPal confirma por su cuenta (webhook): mientras tanto, se vuelve a mirar.
  useEffect(() => {
    if (datos?.estado !== 'pendiente_paypal') return undefined;
    const id = setInterval(leer, 8000);
    return () => clearInterval(id);
  }, [datos?.estado, leer]);

  // UN PAGO CON PAYPAL no espera a la Oficina Nacional: al confirmarse, el
  // servidor genera el certificado y la factura. Aquí se piden y se espera a que
  // estén (el recuadro se queda «generando»); al terminar aparecen y también
  // salen por correo. Si falla, se vuelve a intentar sola y se puede forzar.
  const generandoRef = useRef(false);
  const [fallos, setFallos] = useState(0);
  const esperaDocumentos =
    datos?.estado === 'confirmada' && datos?.tipoPago === 'paypal' && !datos?.documentosListos;

  const pedirDocumentos = useCallback(async () => {
    if (!token || generandoRef.current) return;
    generandoRef.current = true;
    try {
      const respuesta = await fetch(`/api/solicitudes/${encodeURIComponent(token)}/documentos/`, {
        method: 'POST',
      });
      const resultado = await respuesta.json().catch(() => ({}));
      if (resultado.estado === 'listo') {
        setFallos(0);
        await leer();
      } else if (resultado.estado === 'error' || !respuesta.ok) {
        setFallos((n) => n + 1);
      }
    } catch {
      setFallos((n) => n + 1);
    } finally {
      generandoRef.current = false;
    }
  }, [token, leer]);

  useEffect(() => {
    if (!esperaDocumentos) return undefined;
    pedirDocumentos();
    // Mientras tanto se mira cada pocos segundos (otro intento puede haberlos
    // terminado) y, si no hay resultado, se vuelve a pedir.
    let vueltas = 0;
    const id = setInterval(() => {
      vueltas += 1;
      leer();
      if (vueltas % 6 === 0) pedirDocumentos();
    }, 5000);
    return () => clearInterval(id);
  }, [esperaDocumentos, pedirDocumentos, leer]);

  const copiar = (texto) => {
    navigator.clipboard
      ?.writeText(texto)
      .then(() => toast.success('Código copiado.'))
      .catch(() => toast.error('No se pudo copiar. Selecciónalo y cópialo a mano.'));
  };

  const volverAEmpezar = () => {
    reiniciar();
    router.push(PASOS[0].ruta);
  };

  const estado = datos && (ESTADOS[datos.estado] || ESTADOS.pendiente_transferencia);

  return (
    <TarjetaPaso>
      <CabeceraPaso
        indice={3}
        titulo="Estado de tu membresía"
        texto="Aquí ves el resultado de tu registro y descargas tus documentos oficiales."
      />

      {errorPaypal && (
        <Alert severity="error" sx={{ mb: 3 }}>
          No se pudo completar el pago con PayPal. Si se te cobró, escríbenos con tu número de
          transacción.
        </Alert>
      )}

      {!token && !errorPaypal && (
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Alert severity="info">
            Aún no has completado un pago. Empieza eligiendo tu destacamento.
          </Alert>
          <Button variant="contained" onClick={() => router.push(PASOS[0].ruta)}>
            Ir al paso 1
          </Button>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {token && !datos && !error && <Skeleton variant="rounded" height={160} />}

      {estado && (
        <Stack spacing={3}>
          <Card
            variant="outlined"
            sx={(t) => ({
              p: 3,
              position: 'relative',
              borderColor: t.vars.palette[estado.color].light,
              bgcolor: t.vars.palette[estado.color].lighter,
              // La costura del parche: un borde punteado por dentro.
              '&::after': {
                inset: 8,
                content: '""',
                borderRadius: 1.5,
                position: 'absolute',
                pointerEvents: 'none',
                border: `2px dashed ${t.vars.palette[estado.color].main}`,
                opacity: 0.55,
              },
            })}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2.5}
              sx={{ alignItems: { sm: 'center' } }}
            >
              <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <Escena
                  estado={datos.estado}
                  generando={esperaDocumentos}
                  listos={datos.documentosListos}
                />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4" sx={{ color: `${estado.color}.darker` }}>
                  {estado.titulo}
                  {datos.codigo ? ` · ${datos.codigo}` : ''}
                </Typography>
                <Typography sx={{ color: `${estado.color}.darker`, mt: 0.5 }}>
                  {estado.texto}
                </Typography>
                {Object.keys(datos.correcciones || {}).length > 0 &&
                  datos.estado !== 'confirmada' && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ color: 'warning.darker' }}>
                        Datos que corregiste (en revisión):
                      </Typography>
                      {Object.entries(datos.correcciones).map(([campo, c]) => (
                        <Typography key={campo} variant="body2" sx={{ color: 'warning.darker' }}>
                          {NOMBRES_CAMPOS[campo] || campo}: «{c.antes || '—'}» → «{c.despues || '—'}
                          »
                        </Typography>
                      ))}
                    </Box>
                  )}
                {datos.estado === 'rechazada' && datos.motivo && (
                  <Typography variant="subtitle2" sx={{ color: 'error.darker', mt: 1 }}>
                    Motivo: {datos.motivo}
                  </Typography>
                )}
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <Typography variant="subtitle1" sx={{ color: `${estado.color}.darker` }}>
                    Código de tu solicitud:
                  </Typography>
                  {/* Azul marino en claro y en oscuro: la tarjeta es clara en los dos, y
                      con el texto del modo oscuro (blanco) el código no se leía. */}
                  <Typography
                    variant="h6"
                    sx={(t) => ({ letterSpacing: 0.5, color: t.vars.palette.brand.navy })}
                  >
                    {datos.codigoSolicitud}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Iconify icon="solar:copy-bold" />}
                    sx={(t) => ({
                      color: t.vars.palette.brand.navy,
                      borderColor: varAlpha(t.vars.palette.brand.navyChannel, 0.32),
                      '&:hover': {
                        borderColor: t.vars.palette.brand.navy,
                        bgcolor: varAlpha(t.vars.palette.brand.navyChannel, 0.08),
                      },
                    })}
                    onClick={() => copiar(datos.codigoSolicitud)}
                  >
                    Copiar código
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Card>

          {esperaDocumentos && (
            <Alert
              severity={fallos >= 3 ? 'warning' : 'info'}
              icon={<Iconify icon="solar:clock-circle-bold" />}
              action={
                fallos >= 3 && (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setFallos(0);
                      pedirDocumentos();
                    }}
                  >
                    Reintentar
                  </Button>
                )
              }
            >
              <Typography variant="subtitle2">
                {fallos >= 3
                  ? 'Tarda más de lo normal.'
                  : 'Espera: tu certificado y tu factura se están generando.'}
              </Typography>
              <Typography variant="body2">
                {fallos >= 3
                  ? 'Tu pago ya está confirmado. Pulsa Reintentar o vuelve en unos minutos con el enlace que recibirás por correo.'
                  : 'Toma unos segundos; no cierres esta página. Cuando estén listos aparecerán aquí y también te los enviaremos por correo.'}
              </Typography>
              {fallos < 3 && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
            </Alert>
          )}

          {datos.estado === 'confirmada' && !datos.documentosListos && !esperaDocumentos && (
            <Alert severity="info" icon={<Iconify icon="solar:clock-circle-bold" />}>
              Tu pago está confirmado. La Oficina Nacional está preparando tu certificado y tu
              factura: te llegarán por correo y podrás descargarlos aquí.
            </Alert>
          )}

          {datos.estado === 'confirmada' && datos.documentosListos && (
            <>
              <Typography variant="h6">Documentos de tu membresía</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Documento
                    icono="solar:medal-ribbon-star-bold"
                    titulo="Certificado oficial"
                    href={`/api/documentos/${token}/certificado/`}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Documento
                    icono="custom:invoice-duotone"
                    titulo="Factura oficial"
                    href={`/api/documentos/${token}/factura/`}
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* Al terminar: volver al inicio (principal) y bajar el comprobante. */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              size="large"
              variant="contained"
              startIcon={<Brujula tamano={20} />}
              onClick={() => {
                reiniciar();
                router.push('/');
              }}
            >
              Volver al inicio
            </Button>
            <Button
              size="large"
              variant="outlined"
              color="inherit"
              component="a"
              href={`/api/solicitudes/${token}/comprobante/`}
              startIcon={<Mochila tamano={20} sx={{ color: 'success.dark' }} />}
            >
              Descargar comprobante de solicitud (PDF)
            </Button>
          </Stack>

          {datos.estado === 'rechazada' && (
            <Box>
              <Button
                variant="contained"
                startIcon={<Iconify icon="solar:restart-bold" />}
                onClick={volverAEmpezar}
              >
                Registrar el pago de nuevo
              </Button>
            </Box>
          )}
        </Stack>
      )}
    </TarjetaPaso>
  );
}
