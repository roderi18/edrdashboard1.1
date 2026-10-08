'use client';

import * as z from 'zod';
import dayjs from 'dayjs';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { aDolares, formatearRd, formatearUsd } from 'src/utils/planes-membresia.mjs';

import { Upload } from 'src/components/upload';
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
  fecha: z.any().nullable(),
  referencia: z.string().trim(),
  comprobante: z.any().nullable(),
});

// Solo la transferencia exige fecha, referencia y comprobante.
const validarTransferencia = (v) => {
  const errores = {};
  const fecha = v.fecha ? dayjs(v.fecha) : null;
  if (!fecha?.isValid()) errores.fecha = 'Indica la fecha del depósito.';
  else if (fecha.isAfter(dayjs(), 'day')) errores.fecha = 'La fecha no puede ser futura.';
  if (v.referencia.length < 4)
    errores.referencia = 'Escribe el número de confirmación o referencia.';
  if (!v.comprobante) errores.comprobante = 'Adjunta el comprobante (JPG, PNG o PDF).';
  return errores;
};

function PanelPaypal({ total, configuracion, onPagar, enviando }) {
  const usd = aDolares(total, configuracion?.rate);
  const habilitado = configuracion?.lanzamientoHabilitado && configuracion?.paypalEnabled;
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
      {!habilitado && (
        <Alert severity="info">
          El pago con PayPal se habilitará cuando la Oficina Nacional fije la tasa del dólar.
          Mientras tanto, puedes pagar por transferencia.
        </Alert>
      )}
      <Button
        size="large"
        variant="contained"
        color="warning"
        loading={enviando}
        disabled={!habilitado}
        startIcon={<Iconify icon="payments:paypal" width={24} />}
        onClick={onPagar}
      >
        Pagar con PayPal
      </Button>
      <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
        PayPal cobra en dólares. El pago solo se confirma con la respuesta de PayPal al servidor.
      </Typography>
    </Stack>
  );
}

function DatosBancarios({ banco }) {
  if (!banco?.name) {
    return (
      <Alert severity="warning" icon={<Iconify icon="solar:clock-circle-bold" />}>
        Los datos bancarios de la Oficina Nacional se publicarán aquí próximamente.
      </Alert>
    );
  }
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Grid container spacing={1.5}>
        {[
          ['Banco', banco.name],
          ['Titular', banco.accountName],
          ['Tipo de cuenta', banco.accountType],
          ['Número de cuenta', banco.accountNumber],
        ].map(([t, v]) => (
          <Grid key={t} size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t}
            </Typography>
            <Typography variant="subtitle2">{v}</Typography>
          </Grid>
        ))}
      </Grid>
    </Card>
  );
}

export function PasoPago() {
  const router = useRouter();
  const cancelado = useSearchParams().get('paypal') === 'cancelado';
  const listo = useExigirDestacamento();
  const { plan, destacamentoId, configuracion, contacto, setContacto } = useRegistro();
  const [metodo, setMetodo] = useState('transferencia');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const metodos = useForm({
    mode: 'onTouched',
    resolver: zodResolver(Esquema),
    defaultValues: {
      ...contacto,
      fecha: null,
      referencia: '',
      comprobante: null,
    },
  });
  const { control, trigger, getValues, setError: marcarError, handleSubmit } = metodos;

  const abierto = Boolean(configuracion?.lanzamientoHabilitado);
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
      datos.set('date', dayjs(valores.fecha).format('YYYY-MM-DD'));
      datos.set('reference', valores.referencia);
      datos.set('proof', valores.comprobante);
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

        <Tabs value={metodo} onChange={(_, v) => setMetodo(v)} variant="fullWidth" sx={{ mb: 3 }}>
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
            enviando={enviando}
          />
        ) : (
          <Stack spacing={2.5}>
            <Alert severity="info">
              Realiza tu transferencia por{' '}
              <strong>{formatearRd(total, { decimales: true })}</strong> y completa los datos.
              Quedará pendiente de validación por la Oficina Nacional.
            </Alert>
            <DatosBancarios banco={configuracion?.bank} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Monto (RD$)"
                  value={formatearRd(total, { decimales: true })}
                  slotProps={{ input: { readOnly: true } }}
                  helperText="El del plan elegido"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field.DatePicker
                  name="fecha"
                  label="Fecha del depósito *"
                  format="DD/MM/YYYY"
                  disableFuture
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Field.Text
                  name="referencia"
                  label="Número de referencia *"
                  placeholder="Ej. 123456789"
                />
              </Grid>
            </Grid>
            <Controller
              name="comprobante"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Comprobante del depósito *
                  </Typography>
                  <Upload
                    multiple
                    accept={TIPOS_COMPROBANTE}
                    maxSize={MAXIMO_COMPROBANTE}
                    maxFiles={1}
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
            <Button
              type="submit"
              size="large"
              variant="contained"
              loading={enviando}
              disabled={!abierto || !configuracion?.bank?.name || !listo}
              endIcon={<Iconify icon="eva:arrow-forward-fill" />}
            >
              Enviar comprobante
            </Button>
          )}
        </Stack>
      </Form>
    </Card>
  );
}
