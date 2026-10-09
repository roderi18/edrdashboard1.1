'use client';

import * as z from 'zod';
import { useState, useEffect } from 'react';
import { varAlpha } from 'minimal-shared/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { aDolares, formatearRd, formatearUsd } from 'src/utils/planes-membresia.mjs';

import { Upload } from 'src/components/upload';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { CabeceraPaso } from './marco-registro';
import { useExigirDestacamento } from './paso-plan';
import { PASOS, useRegistro } from './contexto-registro';

// ----------------------------------------------------------------------
// PASO 3 · EL PAGO. Primero, a dónde se mandan el certificado y la factura
// (correo y teléfono del que paga). Después, PayPal (en dólares, con la tasa
// del día) o transferencia (con su comprobante, que valida la Oficina
// Nacional). El monto no se escribe: es el del plan, y el servidor lo vuelve
// a calcular.
//
// Mientras la Oficina Nacional no abra los cobros (ONERRD_LANZAMIENTO_HABILITADO),
// la página se ve entera pero no envía nada.
// ----------------------------------------------------------------------

const TIPOS_COMPROBANTE = {
  'image/jpeg': [],
  'image/png': [],
  'application/pdf': [],
};
const MAXIMO_COMPROBANTE = 5 * 1024 * 1024;

const digitos = (v) =>
  String(v || '')
    .replace(/\D/g, '')
    .replace(/^1(?=\d{10}$)/, '');

const Esquema = z.object({
  correo: z
    .string()
    .trim()
    .min(1, 'Escribe el correo donde recibirás los documentos.')
    .pipe(z.email('Correo no válido.')),
  telefono: z.string().refine((v) => digitos(v).length === 10, 'Teléfono de 10 dígitos.'),
  comprobante: z.any().nullable(),
});

// Solo la transferencia exige el comprobante (la fecha y la referencia ya no
// se piden: salen del propio comprobante).
const validarTransferencia = (v) => {
  const errores = {};
  if (!v.comprobante) errores.comprobante = 'Adjunta el comprobante (JPG, PNG o PDF).';
  return errores;
};

function PanelPaypal({ total, configuracion, onPagar, enviando, contactoListo }) {
  const usd = aDolares(total, configuracion?.rate);
  const habilitado = configuracion?.lanzamientoHabilitado && configuracion?.paypalEnabled;
  // Por qué el botón no se puede pulsar, dicho con claridad.
  const aviso = !configuracion
    ? ''
    : !configuracion.lanzamientoHabilitado
      ? 'PayPal se activará cuando la Oficina Nacional abra los cobros.'
      : !habilitado
        ? // Cobros abiertos pero PayPal sin listo (sin clave o sin tasa del día):
          // antes decía "cuando se abran los cobros", que no era la razón.
          'PayPal no está disponible por el momento. Puedes pagar por transferencia bancaria.'
        : !contactoListo
          ? 'Completa tu correo y teléfono para habilitar el pago.'
          : '';
  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        {[
          ['Total en RD$', formatearRd(total, { decimales: true })],
          ['Equivalente en USD', usd ? formatearUsd(usd) : '—'],
          [
            'Tasa del día',
            configuracion?.rate ? `RD$${configuracion.rate} = US$1` : 'Por confirmar',
          ],
        ].map(([titulo, valor]) => (
          <Grid key={titulo} size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ p: 2, height: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {titulo}
              </Typography>
              <Typography variant="h5">{valor}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Button
        size="large"
        variant="contained"
        color="primary"
        loading={enviando}
        disabled={!habilitado}
        startIcon={<Iconify icon="payments:paypal" width={24} />}
        onClick={onPagar}
        sx={{ py: 1.5, fontSize: 16 }}
      >
        Pagar con PayPal
      </Button>
      {aviso && (
        <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold" />}>
          {aviso}
        </Alert>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        PayPal cobra en dólares. El pago solo se confirma con la respuesta de PayPal al servidor.
      </Typography>
    </Stack>
  );
}

// Logo del banco (ícono de su web) o, si no carga, su inicial.
function LogoBanco({ banco }) {
  return (
    <Avatar
      src={banco.logo || undefined}
      alt={banco.name}
      variant="rounded"
      sx={{ width: 40, height: 40, bgcolor: 'primary.lighter', color: 'primary.dark' }}
    >
      {banco.name.charAt(0)}
    </Avatar>
  );
}

const copiar = (texto, que) =>
  navigator.clipboard
    ?.writeText(texto)
    .then(() => toast.success(`${que} copiado.`))
    .catch(() => toast.error('No se pudo copiar. Selecciónalo y cópialo a mano.'));

function DatosBancarios({ bancos }) {
  if (!bancos?.length) {
    return (
      <Alert severity="warning" icon={<Iconify icon="solar:clock-circle-bold" />}>
        Los datos bancarios de la Oficina Nacional se publicarán aquí próximamente.
      </Alert>
    );
  }
  return (
    <Stack spacing={1.5}>
      {bancos.length > 1 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Transfiere a cualquiera de estas cuentas.
        </Typography>
      )}
      {bancos.map((banco) => (
        <Card key={`${banco.name}-${banco.accountNumber}`} variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
            <LogoBanco banco={banco} />
            <Typography variant="subtitle1">{banco.name}</Typography>
          </Stack>
          <Grid container spacing={1.5}>
            {[
              ['Titular', banco.accountName],
              ['Tipo de cuenta', banco.accountType],
              ['Número de cuenta', banco.accountNumber],
              ['Cédula/RNC', banco.document],
            ]
              .filter(([, v]) => v)
              .map(([t, v]) => (
                <Grid key={t} size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography variant="subtitle2">{v}</Typography>
                    {/* El número de cuenta y la cédula se copian de un toque. */}
                    {(t === 'Número de cuenta' || t === 'Cédula/RNC') && (
                      <Tooltip title={`Copiar ${t.toLowerCase()}`}>
                        <IconButton
                          size="small"
                          onClick={() => copiar(v, t)}
                          aria-label={`Copiar ${t}`}
                        >
                          <Iconify icon="solar:copy-bold" width={18} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Grid>
              ))}
          </Grid>
        </Card>
      ))}
    </Stack>
  );
}

export function PasoPago() {
  const router = useRouter();
  const cancelado = useSearchParams().get('paypal') === 'cancelado';
  const listo = useExigirDestacamento();
  const {
    plan,
    destacamentoId,
    configuracion,
    contacto,
    setContacto,
    correcciones,
    corregidoPor,
    registradoPor,
  } = useRegistro();
  const hayCorrecciones = Object.keys(correcciones).length > 0;
  // La pestaña elegida (transferencia o PayPal) sobrevive a recargar.
  const [metodo, setMetodoEnPantalla] = useState(() => {
    try {
      return sessionStorage.getItem('onerrd-membresia-2027-metodo') || 'transferencia';
    } catch {
      return 'transferencia';
    }
  });
  const setMetodo = (valor) => {
    setMetodoEnPantalla(valor);
    try {
      sessionStorage.setItem('onerrd-membresia-2027-metodo', valor);
    } catch {
      // Sin almacenamiento: solo no se recuerda.
    }
  };
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const metodos = useForm({
    mode: 'onTouched',
    resolver: zodResolver(Esquema),
    defaultValues: {
      ...contacto,
      comprobante: null,
    },
  });
  const { control, trigger, getValues, setValue, setError: marcarError, handleSubmit } = metodos;

  // Correo y teléfono se guardan mientras se escriben (sobreviven a recargar)
  // y, si llegan restaurados después de pintar, se rellenan.
  const correoEscrito = useWatch({ control, name: 'correo' });
  const telefonoEscrito = useWatch({ control, name: 'telefono' });
  useEffect(() => {
    if (correoEscrito !== contacto.correo || telefonoEscrito !== contacto.telefono) {
      setContacto({ correo: correoEscrito || '', telefono: telefonoEscrito || '' });
    }
    // Solo cuando cambia lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correoEscrito, telefonoEscrito]);
  useEffect(() => {
    if (!getValues('correo') && contacto.correo) setValue('correo', contacto.correo);
    if (!getValues('telefono') && contacto.telefono) setValue('telefono', contacto.telefono);
  }, [contacto, getValues, setValue]);

  const abierto = Boolean(configuracion?.lanzamientoHabilitado);
  const contactoListo =
    /^\S+@\S+\.\S+$/.test(correoEscrito || '') && digitos(telefonoEscrito || '').length === 10;
  const total = plan?.precio || 0;

  const guardarContacto = () => {
    const { correo, telefono } = getValues();
    setContacto({ correo, telefono });
  };

  const pagarConPaypal = async () => {
    if (!(await trigger(['correo', 'telefono']))) return;
    guardarContacto();
    setEnviando(true);
    setError('');
    try {
      const { correo, telefono } = getValues();
      const r = await fetch('/api/paypal/crear/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destacamentoId,
          planId: plan.id,
          email: correo,
          phone: telefono,
          correcciones,
          corregidoPor,
          registradoPor,
        }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok || !datos.approve)
        throw new Error(datos.error || 'No se pudo preparar el pago con PayPal.');
      window.location.assign(datos.approve);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  const enviarTransferencia = handleSubmit(async (valores) => {
    const errores = validarTransferencia(valores);
    if (Object.keys(errores).length) {
      Object.entries(errores).forEach(([campo, message]) => marcarError(campo, { message }));
      return;
    }
    guardarContacto();
    setEnviando(true);
    setError('');
    try {
      const datos = new FormData();
      datos.set('destacamentoId', destacamentoId);
      datos.set('planId', plan.id);
      datos.set('email', valores.correo);
      datos.set('phone', valores.telefono);
      datos.set('amount', String(total));
      datos.set('proof', valores.comprobante);
      datos.set('correcciones', JSON.stringify(correcciones));
      if (corregidoPor) datos.set('corregidoPor', JSON.stringify(corregidoPor));
      datos.set('registradoPor', JSON.stringify(registradoPor));
      const r = await fetch('/api/membresias/', {
        method: 'POST',
        body: datos,
      });
      const respuesta = await r.json().catch(() => ({}));
      if (!r.ok || !respuesta.token)
        throw new Error(respuesta.error || 'No se pudo enviar el comprobante.');
      router.push(`${PASOS[3].ruta}?solicitud=${respuesta.token}`);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  });

  return (
    <Card sx={{ p: { xs: 2.5, md: 4 } }}>
      <CabeceraPaso
        indice={2}
        titulo="Selecciona tu método de pago"
        texto="Paga en línea con PayPal o por transferencia bancaria."
      />

      {!abierto && configuracion && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Los pagos de la membresía 2027 aún no están abiertos. Puedes revisar el proceso; el botón
          de pago se activará cuando la Oficina Nacional lo apruebe.
        </Alert>
      )}
      {hayCorrecciones && (
        <Alert severity="info" icon={<Iconify icon="solar:pen-bold" />} sx={{ mb: 3 }}>
          Corregiste datos del destacamento: tu pago quedará <strong>en revisión</strong> hasta que
          la Oficina Nacional confirme los cambios. Te avisaremos por correo; después recibirás el
          certificado y la factura.
        </Alert>
      )}
      {cancelado && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Cancelaste el pago en PayPal. No se cobró nada: puedes intentarlo de nuevo.
        </Alert>
      )}

      <Form methods={metodos} onSubmit={enviarTransferencia}>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          ¿A dónde enviamos el certificado y la factura?
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Usaremos estos datos solo para esta membresía.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Field.Text
              name="correo"
              label="Correo electrónico *"
              type="email"
              autoComplete="email"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Field.Phone name="telefono" label="Teléfono *" defaultCountry="DO" maxDigitos={10} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          Elige cómo pagar
        </Typography>
        <Tabs
          value={metodo}
          onChange={(_, v) => setMetodo(v)}
          variant="fullWidth"
          TabIndicatorProps={{ sx: { display: 'none' } }}
          sx={(t) => ({
            mb: 3,
            minHeight: 56,
            gap: 1.5,
            '& .MuiTabs-flexContainer': { gap: 1.5 },
            '& .MuiTab-root': {
              minHeight: 56,
              borderRadius: 1.5,
              fontSize: 15,
              fontWeight: 700,
              border: `1.5px solid ${t.vars.palette.divider}`,
              color: 'text.secondary',
            },
            '& .MuiTab-root.Mui-selected': {
              color: 'primary.main',
              borderColor: 'primary.main',
              bgcolor: varAlpha(t.vars.palette.primary.mainChannel, 0.08),
            },
          })}
        >
          <Tab
            value="transferencia"
            label="Transferencia bancaria"
            icon={<Iconify icon="solar:transfer-horizontal-bold-duotone" />}
            iconPosition="start"
          />
          <Tab
            value="paypal"
            label="PayPal"
            icon={<Iconify icon="payments:paypal" />}
            iconPosition="start"
          />
        </Tabs>

        {!listo || !plan ? null : metodo === 'paypal' ? (
          <PanelPaypal
            total={total}
            configuracion={configuracion}
            onPagar={pagarConPaypal}
            contactoListo={contactoListo}
            enviando={enviando}
          />
        ) : (
          <Stack spacing={2.5}>
            <Alert severity="info">
              Transfiere <strong>{formatearRd(total, { decimales: true })}</strong> a una de estas
              cuentas y sube el comprobante. La Oficina Nacional confirmará el pago.
            </Alert>
            <DatosBancarios bancos={configuracion?.banks} />
            <Controller
              name="comprobante"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Comprobante de la transferencia *
                  </Typography>
                  <Upload
                    multiple
                    accept={TIPOS_COMPROBANTE}
                    maxSize={MAXIMO_COMPROBANTE}
                    maxFiles={1}
                    // En pantallas grandes, más delgado: ilustración chica y el
                    // texto a su lado, en una sola franja.
                    sx={(t) => ({
                      [t.breakpoints.up('lg')]: {
                        minHeight: 110,
                        py: 1.5,
                        '& > div': { flexDirection: 'row', gap: 3 },
                        '& svg': { width: 96, height: 'auto' },
                      },
                    })}
                    value={field.value ? [field.value] : []}
                    onDrop={(archivos) => archivos[0] && field.onChange(archivos[0])}
                    onRemove={() => field.onChange(null)}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message || 'JPG, PNG o PDF de hasta 5 MB.'}
                  />
                </Box>
              )}
            />
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'space-between' }}>
          <Button
            size="large"
            variant="outlined"
            startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
            onClick={() => {
              guardarContacto();
              router.push(PASOS[1].ruta);
            }}
          >
            Atrás
          </Button>
          {metodo === 'transferencia' && (
            <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
              <Button
                type="submit"
                size="large"
                variant="contained"
                loading={enviando}
                disabled={!abierto || !configuracion?.banks?.length || !listo}
                endIcon={<Iconify icon="eva:arrow-forward-fill" />}
              >
                Enviar comprobante
              </Button>
              {/* Que no parezca roto: dice por qué no se puede enviar. */}
              {configuracion && !abierto && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Se activa cuando la Oficina Nacional abra los cobros.
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </Form>
    </Card>
  );
}
