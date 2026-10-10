import dayjs from 'dayjs';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import FormControlLabel from '@mui/material/FormControlLabel';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import {
  aDolares,
  BANCOS_RD,
  cuentaVacia,
  logoDeBanco,
  tasaVigente,
  formatearRd,
  IDS_DE_PLANES,
  vigenciaUnAnio,
  construirPlanes,
  aIsoSantoDomingo,
  hoyEnSantoDomingo,
  MAXIMO_DE_CUENTAS,
  FUENTE_TASA_AUTOMATICA,
  problemasDeConfiguracion,
  normalizarNumeroDestacamento,
  sanearConfiguracionMembresia,
  CONFIGURACION_MEMBRESIA_DE_FABRICA,
} from 'src/utils/membresia-onerrd.mjs';

import {
  actualizarTasaAhora,
  guardarSecretosMembresia,
  leerConfiguracionMembresia,
  leerEstadoSecretosMembresia,
  guardarConfiguracionMembresia,
} from 'src/services/membresia-onerrd-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { TituloDesplegable } from './factura-editor';

// ----------------------------------------------------------------------
// "MEMBRESÍA 2027 · LANDING": todo lo que la landing de pago lee y se puede
// cambiar sin tocar código. Montos, descuento, los tres planes, qué
// destacamentos tienen licencia, la cuenta bancaria, PayPal, la tasa del dólar
// y si los cobros están abiertos. Se guarda en
// `configuracionMembresia2027/general` y la landing lo usa al momento.
// Reglas y saneado en `src/utils/membresia-onerrd.mjs`.
// ----------------------------------------------------------------------

// Dónde está la landing (para el botón "Abrir landing"). En local, su puerto.
const FABRICA = sanearConfiguracionMembresia(CONFIGURACION_MEMBRESIA_DE_FABRICA);

const URL_LANDING =
  process.env.NEXT_PUBLIC_URL_MEMBRESIA_ONERRD ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3050' : '');

const TIPOS_DE_CUENTA = ['Ahorros', 'Corriente'];

// "31/12/2027" → dayjs (sin el plugin de formatos, que no está cargado).
const aDayjs = (ddmmaaaa) => {
  const [d, m, a] = String(ddmmaaaa || '').split('/');
  const fecha = dayjs(`${a}-${m}-${d}`);
  return fecha.isValid() ? fecha : null;
};

const formatearFechaIso = (iso) => (iso ? dayjs(iso).format('DD/MM/YYYY') : '');

// Cada sección es su propio desplegable, cerrado al entrar: se abre la que se
// va a cambiar (pueden estar varias abiertas).
function Bloque({ icono, titulo, texto, children }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Box>
      <ButtonBase
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        sx={{ width: 1, gap: 1, py: 0.5, borderRadius: 1, justifyContent: 'flex-start' }}
      >
        <Iconify
          icon="eva:arrow-ios-downward-fill"
          width={18}
          sx={{ transition: 'transform 0.2s', transform: abierto ? 'none' : 'rotate(-90deg)' }}
        />
        <Iconify icon={icono} width={20} sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1">{titulo}</Typography>
      </ButtonBase>
      <Collapse in={abierto}>
        <Box sx={{ pt: 1, pl: { sm: 3.5 } }}>
          {texto && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {texto}
            </Typography>
          )}
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

function CampoMonto({ label, value, onChange, helperText }) {
  return (
    <TextField
      fullWidth
      type="number"
      label={label}
      value={value}
      helperText={helperText}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      slotProps={{
        input: { startAdornment: <InputAdornment position="start">RD$</InputAdornment> },
        htmlInput: { min: 0, step: 50 },
      }}
    />
  );
}

// Logo del banco (ícono de su web) o, si no hay, su inicial.
function LogoDeBanco({ nombre }) {
  return (
    <Avatar
      src={logoDeBanco(nombre) || undefined}
      alt={nombre}
      variant="rounded"
      sx={{
        width: 24,
        height: 24,
        fontSize: 12,
        bgcolor: 'primary.lighter',
        color: 'primary.dark',
      }}
    >
      {nombre.charAt(0)}
    </Avatar>
  );
}

// ----------------------------------------------------------------------
// EL CIERRE DE LAS INSCRIPCIONES (la misma forma que la cuenta atrás de la
// landing de registro de destacamentos). El calendario trabaja en la hora del
// navegador; el cierre se guarda en la de Santo Domingo: se "traslada" el
// instante al mostrarlo y al guardarlo, para que lo que se ve sea la hora
// dominicana aunque quien lo cambie esté en otro huso.
// ----------------------------------------------------------------------

const desfaseLocalMin = () => -new Date().getTimezoneOffset();
const cierreAVista = (iso) => (iso ? dayjs(iso).add(-4 * 60 - desfaseLocalMin(), 'minute') : null);
const cierreDeVista = (valor) =>
  aIsoSantoDomingo(
    dayjs(valor)
      .add(4 * 60 + desfaseLocalMin(), 'minute')
      .toDate()
  );

function ContadorDeCierre({ fecha }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const restante = Date.parse(fecha) - ahora;
  if (restante <= 0) return <Label color="error">Plazo terminado</Label>;
  const s = Math.floor(restante / 1000);
  return (
    <Stack direction="row" spacing={1}>
      {[
        [Math.floor(s / 86400), 'Días'],
        [Math.floor((s % 86400) / 3600), 'Horas'],
        [Math.floor((s % 3600) / 60), 'Minutos'],
        [s % 60, 'Segundos'],
      ].map(([valor, texto]) => (
        <Box
          key={texto}
          sx={{
            minWidth: 64,
            py: 0.5,
            textAlign: 'center',
            borderRadius: 1,
            bgcolor: 'background.neutral',
          }}
        >
          <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
            {String(valor).padStart(2, '0')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {texto}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

const ATAJOS_CIERRE = [
  { etiqueta: '+1 día', dias: 1 },
  { etiqueta: '+7 días', dias: 7 },
];

// Los atajos suman a la fecha elegida (o a ahora, si no hay).
const cierreMasDias = (fecha, dias) =>
  aIsoSantoDomingo((fecha ? Date.parse(fecha) : Date.now()) + dias * 86_400_000);

function CierreDeInscripciones({ cierre, cambiar }) {
  const sumarDias = (dias) => cambiar('cierre.fecha', cierreMasDias(cierre.fecha, dias));
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { sm: 'center' } }}
      >
        <DateTimePicker
          label="Cierre (hora de Santo Domingo)"
          format="DD/MM/YYYY hh:mm A"
          ampm
          value={cierreAVista(cierre.fecha)}
          onChange={(v) => v?.isValid() && cambiar('cierre.fecha', cierreDeVista(v))}
          slotProps={{ textField: { sx: { minWidth: 260 } } }}
        />
        {ATAJOS_CIERRE.map((a) => (
          <Button
            key={a.etiqueta}
            size="small"
            variant="outlined"
            onClick={() => sumarDias(a.dias)}
          >
            {a.etiqueta}
          </Button>
        ))}
        {cierre.fecha && (
          <Button size="small" color="inherit" onClick={() => cambiar('cierre.fecha', '')}>
            Sin cierre
          </Button>
        )}
      </Stack>
      {cierre.fecha ? (
        <ContadorDeCierre fecha={cierre.fecha} />
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Sin fecha de cierre: las inscripciones siguen abiertas y no se enseña cuenta atrás.
        </Typography>
      )}
      <TextField
        label="Texto encima de la cuenta atrás"
        value={cierre.texto}
        onChange={(e) => cambiar('cierre.texto', e.target.value)}
        inputProps={{ maxLength: 120 }}
        fullWidth
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormControlLabel
          control={
            <Switch
              checked={cierre.mostrar}
              onChange={(e) => cambiar('cierre.mostrar', e.target.checked)}
            />
          }
          label="Mostrar la cuenta atrás en la landing"
        />
        <FormControlLabel
          control={
            <Switch
              checked={cierre.cerrarAlTerminar}
              onChange={(e) => cambiar('cierre.cerrarAlTerminar', e.target.checked)}
            />
          }
          label="Cerrar las inscripciones al llegar a cero"
        />
      </Stack>
    </Stack>
  );
}

export function MembresiaOnerrdConfig({ abierto, onAlternar, user }) {
  // Se pinta al instante con lo de fábrica (todas las opciones a la vista) y
  // se reemplaza por lo guardado en cuanto llega; mientras, no se guarda.
  const [guardada, setGuardada] = useState(FABRICA);
  const [config, setConfig] = useState(FABRICA);
  const [cargada, setCargada] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [secretos, setSecretos] = useState(null);
  const [claveSecreta, setClaveSecreta] = useState('');
  const [webhookId, setWebhookId] = useState('');
  const [guardandoSecretos, setGuardandoSecretos] = useState(false);
  const [leyendoTasa, setLeyendoTasa] = useState(false);

  // Se lee al montar la pestaña (no al abrir): al desplegar ya está.
  useEffect(() => {
    leerConfiguracionMembresia()
      .then((c) => {
        setGuardada(c);
        setConfig(c);
        setCargada(true);
      })
      .catch(() => setError('No se pudo leer la configuración de la membresía.'));
    leerEstadoSecretosMembresia()
      .then((s) => {
        setSecretos(s);
        setWebhookId(s.webhookId || '');
      })
      .catch(() => setSecretos({ claveSecretaConfigurada: false, webhookId: '', error: true }));
  }, []);

  const vigenciaHoy = useMemo(() => vigenciaUnAnio(), []);

  const cambiar = useCallback((ruta, valor) => {
    setConfig((actual) => {
      const copia = structuredClone(actual);
      const partes = ruta.split('.');
      const ultimo = partes.pop();
      partes.reduce((o, k) => o[k], copia)[ultimo] = valor;
      return copia;
    });
  }, []);

  // Siempre hay al menos una tarjeta de cuenta a la vista, aunque esté vacía.
  const cuentas = config.cuentas.length ? config.cuentas : [cuentaVacia()];
  const cambiarCuenta = (indice, campo, valor) =>
    setConfig((actual) => {
      const lista = actual.cuentas.length ? [...actual.cuentas] : [cuentaVacia()];
      lista[indice] = { ...lista[indice], [campo]: valor };
      return { ...actual, cuentas: lista };
    });
  const agregarCuenta = () =>
    setConfig((actual) => ({
      ...actual,
      cuentas: [...(actual.cuentas.length ? actual.cuentas : [cuentaVacia()]), cuentaVacia()],
    }));
  const quitarCuenta = (indice) =>
    setConfig((actual) => ({ ...actual, cuentas: actual.cuentas.filter((_, i) => i !== indice) }));

  const limpia = useMemo(() => (config ? sanearConfiguracionMembresia(config) : null), [config]);
  const planes = useMemo(() => (limpia ? construirPlanes(limpia) : null), [limpia]);
  const problemas = useMemo(() => (limpia ? problemasDeConfiguracion(limpia) : []), [limpia]);
  const hayCambios =
    cargada && Boolean(config && guardada) && JSON.stringify(limpia) !== JSON.stringify(guardada);
  const tasaHoy = guardada ? tasaVigente(guardada) : null;

  const guardar = async () => {
    if (problemas.length) {
      toast.error(problemas[0]);
      return;
    }
    // Al instante: se da por guardado y la escritura va por detrás; si falla,
    // vuelve lo anterior y se avisa.
    const anterior = guardada;
    const enviada = limpia;
    setGuardada(enviada);
    setGuardando(true);
    toast.success('Guardado. La landing ya usa estos datos.');
    try {
      const nueva = await guardarConfiguracionMembresia({ configuracion: enviada, anterior, user });
      setGuardada(nueva);
      setConfig((actual) =>
        JSON.stringify(sanearConfiguracionMembresia(actual)) === JSON.stringify(enviada)
          ? nueva
          : actual
      );
      // Al encender la automática se lee ya; desde mañana, la tarea de las 6:00.
      if (nueva.tasa.automatica && !anterior.tasa.automatica) actualizarTasa();
    } catch (e) {
      setGuardada(anterior);
      toast.error(e.message || 'No se pudo guardar. Se deshizo el cambio.');
    } finally {
      setGuardando(false);
    }
  };

  // "Actualizar ahora": la tarea de las 6:00 a. m. sin esperar. La tasa nueva
  // entra en lo guardado y en el formulario (sin tocar lo demás que se edita).
  const actualizarTasa = async () => {
    setLeyendoTasa(true);
    try {
      const { ok, tasa } = await actualizarTasaAhora();
      setGuardada((g) => ({ ...g, tasa }));
      setConfig((c) => ({ ...c, tasa }));
      if (ok) toast.success(`Tasa actualizada: RD$${tasa.base} por US$1.`);
      else toast.error(`No se pudo leer: ${tasa.ultimoError} Sigue la anterior.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLeyendoTasa(false);
    }
  };

  // RED DE SEGURIDAD de la tasa automática: la tarea de las 6:00 a. m. vive en
  // Cloud Scheduler y no corre en local ni mientras no esté creada. Si al abrir
  // el panel la automática está encendida y la última lectura no es de hoy
  // (pasadas las 6:00, hora de Santo Domingo), se lee en ese momento. Una vez
  // por apertura; si falla, no insiste.
  const [intentoAuto, setIntentoAuto] = useState(false);
  useEffect(() => {
    if (!cargada || intentoAuto || !guardada.tasa.automatica) return;
    const hora = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Santo_Domingo',
        hour: '2-digit',
        hour12: false,
      }).format(new Date())
    );
    if (hora < 6 || guardada.tasa.fecha === hoyEnSantoDomingo()) return;
    setIntentoAuto(true);
    actualizarTasaAhora()
      .then(({ ok, tasa }) => {
        setGuardada((g) => ({ ...g, tasa }));
        setConfig((c) => ({ ...c, tasa }));
        if (ok) toast.success(`Tasa del dólar actualizada: RD$${tasa.base} por US$1.`);
      })
      .catch(() => {});
  }, [cargada, intentoAuto, guardada.tasa.automatica, guardada.tasa.fecha]);

  const guardarPaypalSecreto = async ({ borrar = false } = {}) => {
    setGuardandoSecretos(true);
    try {
      await guardarSecretosMembresia({
        claveSecreta: borrar ? '' : claveSecreta.trim(),
        borrarClave: borrar,
        webhookId: webhookId.trim(),
        user,
      });
      setClaveSecreta('');
      setSecretos(await leerEstadoSecretosMembresia());
      // El Client ID va con la clave: antes solo se guardaba con el «Guardar» de
      // abajo y quedaba el anterior (la clave y el ID de apps distintas).
      if (!borrar && limpia.paypal.clientId !== guardada.paypal.clientId) await guardar();
      toast.success(borrar ? 'Clave de PayPal quitada.' : 'Credenciales de PayPal guardadas.');
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar la clave de PayPal.');
    } finally {
      setGuardandoSecretos(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <Iconify icon="solar:settings-bold" sx={{ color: 'primary.main' }} />
        <TituloDesplegable
          titulo="Membresía 2027 · landing"
          abierto={abierto}
          onAlternar={onAlternar}
        />
        {abierto && (
          <>
            <Label color={guardada.cobrosAbiertos ? 'success' : 'default'}>
              {guardada.cobrosAbiertos ? 'Cobros abiertos' : 'Cobros cerrados'}
            </Label>
            {URL_LANDING && (
              <Button
                size="small"
                color="inherit"
                href={URL_LANDING}
                target="_blank"
                rel="noopener"
                startIcon={<Iconify icon="eva:external-link-fill" />}
              >
                Abrir landing
              </Button>
            )}
            <Button
              size="small"
              color="inherit"
              disabled={!hayCambios}
              startIcon={<Iconify icon="solar:restart-bold" />}
              onClick={() => setConfig(guardada)}
            >
              Descartar
            </Button>
            <LoadingButton
              size="small"
              variant="contained"
              loading={guardando}
              disabled={!hayCambios}
              onClick={guardar}
              startIcon={
                <Iconify icon={hayCambios ? 'solar:file-text-bold' : 'solar:check-circle-bold'} />
              }
            >
              {hayCambios ? 'Guardar' : 'Guardado'}
            </LoadingButton>
          </>
        )}
      </Stack>

      <Collapse in={abierto}>
        <Box sx={{ mt: 2.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {!cargada && !error && <LinearProgress sx={{ mb: 2 }} />}

          {config && (
            <Stack spacing={1.5} divider={<Divider />}>
              {/* -------- Estado -------- */}
              <Bloque
                icono="solar:shield-check-bold"
                titulo="Cobros"
                texto="Cerrados, la landing se ve entera pero no deja pagar. Ábrelos cuando la cuenta o PayPal estén listos."
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.cobrosAbiertos}
                      onChange={(e) => cambiar('cobrosAbiertos', e.target.checked)}
                    />
                  }
                  label={config.cobrosAbiertos ? 'Cobros abiertos' : 'Cobros cerrados'}
                />
                {problemas.map((p) => (
                  <Alert key={p} severity="warning" sx={{ mt: 1 }}>
                    {p}
                  </Alert>
                ))}
              </Bloque>

              {/* -------- Cierre -------- */}
              <Bloque
                icono="solar:clock-circle-bold"
                titulo="Cierre de inscripciones"
                texto="Fecha y hora (de Santo Domingo) en que cierran las inscripciones. La landing enseña la cuenta atrás debajo del botón de registro y, al llegar, deja de cobrar."
              >
                <CierreDeInscripciones cierre={config.cierre} cambiar={cambiar} />
              </Bloque>

              {/* -------- Montos -------- */}
              <Bloque
                icono="solar:wad-of-money-bold"
                titulo="Montos y vigencia"
                texto="Cada plan suma estas piezas; el desglose de la factura sale de aquí."
              >
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <CampoMonto
                      label="Cuota de registro"
                      value={config.cuotaRegistro}
                      onChange={(v) => cambiar('cuotaRegistro', v)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <CampoMonto
                      label="RRI TRaC"
                      value={config.precioRriTrac}
                      onChange={(v) => cambiar('precioRriTrac', v)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <CampoMonto
                      label="Descuento por fidelidad"
                      value={config.descuentoFidelidad}
                      onChange={(v) => cambiar('descuentoFidelidad', v)}
                      helperText="Para los registrados en 2026"
                    />
                  </Grid>
                  <Grid size={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.vigencia.automatica}
                          onChange={(e) => cambiar('vigencia.automatica', e.target.checked)}
                        />
                      }
                      label="Fecha actual + 1 año"
                    />
                    <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                      {config.vigencia.automatica
                        ? `Cada membresía vale desde el día en que se paga hasta la misma fecha del año siguiente (hoy: ${vigenciaHoy.desde} – ${vigenciaHoy.hasta}). Así lo enseña la landing.`
                        : 'Todas las membresías valen el mismo rango fijo; la landing enseña estas fechas.'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker
                      label="Vigencia desde"
                      format="DD/MM/YYYY"
                      disabled={config.vigencia.automatica}
                      value={aDayjs(
                        config.vigencia.automatica ? vigenciaHoy.desde : config.vigencia.desde
                      )}
                      onChange={(v) =>
                        v?.isValid() && cambiar('vigencia.desde', v.format('DD/MM/YYYY'))
                      }
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DatePicker
                      label="Vigencia hasta"
                      format="DD/MM/YYYY"
                      disabled={config.vigencia.automatica}
                      value={aDayjs(
                        config.vigencia.automatica ? vigenciaHoy.hasta : config.vigencia.hasta
                      )}
                      onChange={(v) =>
                        v?.isValid() && cambiar('vigencia.hasta', v.format('DD/MM/YYYY'))
                      }
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Grid>
                </Grid>

                {/* Los tres planes, dentro de Montos: cada uno suma las piezas de arriba. */}
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 3, mb: 0.5 }}>
                  <Iconify icon="solar:bill-list-bold" width={20} sx={{ color: 'primary.main' }} />
                  <Typography variant="subtitle2">Los tres planes</Typography>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Lo que ve cada destacamento en la landing. Apagado, un plan no se ofrece.
                </Typography>
                <Grid container spacing={2}>
                  {IDS_DE_PLANES.map((id) => {
                    const plan = planes[id];
                    return (
                      <Grid key={id} size={{ xs: 12, md: 4 }}>
                        <Card
                          variant="outlined"
                          sx={{ p: 2, height: 1, opacity: plan.activo ? 1 : 0.6 }}
                        >
                          <Stack
                            direction="row"
                            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <Typography variant="h5" sx={{ color: `${plan.color}.main` }}>
                              {formatearRd(plan.precio)}
                            </Typography>
                            <Switch
                              checked={config.planes[id].activo}
                              onChange={(e) => cambiar(`planes.${id}.activo`, e.target.checked)}
                              slotProps={{ input: { 'aria-label': `Activar ${plan.nombre}` } }}
                            />
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {[
                              `Cuota ${formatearRd(plan.cuotaRegistro)}`,
                              plan.rriTrac
                                ? `RRI TRaC ${formatearRd(plan.rriTrac)}`
                                : 'sin RRI TRaC',
                              plan.descuento ? `− ${formatearRd(plan.descuento)}` : '',
                            ]
                              .filter(Boolean)
                              .join(' + ')
                              .replace('+ −', '−')}
                          </Typography>
                          <Stack spacing={1.5} sx={{ mt: 2 }}>
                            <TextField
                              size="small"
                              label="Nombre"
                              value={config.planes[id].nombre}
                              onChange={(e) => cambiar(`planes.${id}.nombre`, e.target.value)}
                            />
                            <TextField
                              size="small"
                              label="Detalle"
                              value={config.planes[id].detalle}
                              onChange={(e) => cambiar(`planes.${id}.detalle`, e.target.value)}
                            />
                            <TextField
                              size="small"
                              label="Etiqueta"
                              value={config.planes[id].etiqueta}
                              onChange={(e) => cambiar(`planes.${id}.etiqueta`, e.target.value)}
                            />
                          </Stack>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Bloque>

              {/* -------- Licencias -------- */}
              <Bloque
                icono="solar:monitor-bold"
                titulo="Destacamentos con licencia RRI TRaC"
                texto={`Solo estos ven el plan «${planes.solo_registro.nombre}». Escribe el número y pulsa Enter.`}
              >
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={config.licencias}
                  onChange={(_, lista) =>
                    cambiar(
                      'licencias',
                      [...new Set(lista.map(normalizarNumeroDestacamento))].filter(Boolean)
                    )
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Ej. 97"
                      helperText="Número de destacamento"
                    />
                  )}
                />
              </Bloque>

              {/* -------- Banco -------- */}
              <Bloque
                icono="solar:transfer-horizontal-bold-duotone"
                titulo="Cuentas bancarias"
                texto="Salen todas en el paso de pago por transferencia de la landing. El pago solo se puede enviar con los cobros abiertos."
              >
                <Stack spacing={2}>
                  {cuentas.map((cuenta, indice) => (
                    <Card key={indice} variant="outlined" sx={{ p: 2 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
                      >
                        <Typography variant="subtitle2">
                          {cuentas.length > 1 ? `Cuenta ${indice + 1}` : 'Cuenta'}
                        </Typography>
                        {config.cuentas.length > 0 && (
                          <Tooltip title="Quitar esta cuenta">
                            <IconButton size="small" onClick={() => quitarCuenta(indice)}>
                              <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          {/* De la lista de bancos del país; si no está, se escribe. */}
                          <Autocomplete
                            freeSolo
                            options={BANCOS_RD.map((b) => b.nombre)}
                            value={cuenta.banco}
                            onChange={(_, v) => cambiarCuenta(indice, 'banco', v || '')}
                            onInputChange={(_, v, motivo) =>
                              motivo === 'input' && cambiarCuenta(indice, 'banco', v)
                            }
                            renderOption={({ key, ...props }, opcion) => (
                              <Box component="li" key={key} {...props} sx={{ gap: 1.5 }}>
                                <LogoDeBanco nombre={opcion} />
                                {opcion}
                              </Box>
                            )}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Banco"
                                InputProps={{
                                  ...params.InputProps,
                                  startAdornment: cuenta.banco ? (
                                    <InputAdornment position="start" sx={{ ml: 0.5 }}>
                                      <LogoDeBanco nombre={cuenta.banco} />
                                    </InputAdornment>
                                  ) : null,
                                }}
                              />
                            )}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Titular de la cuenta"
                            value={cuenta.titular}
                            onChange={(e) => cambiarCuenta(indice, 'titular', e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            select
                            fullWidth
                            label="Tipo de cuenta"
                            value={cuenta.tipoCuenta}
                            onChange={(e) => cambiarCuenta(indice, 'tipoCuenta', e.target.value)}
                          >
                            <MenuItem value="">—</MenuItem>
                            {TIPOS_DE_CUENTA.map((t) => (
                              <MenuItem key={t} value={t}>
                                {t}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            fullWidth
                            label="Número de cuenta"
                            value={cuenta.numeroCuenta}
                            onChange={(e) => cambiarCuenta(indice, 'numeroCuenta', e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            fullWidth
                            label="Cédula/RNC"
                            value={cuenta.documento}
                            onChange={(e) => cambiarCuenta(indice, 'documento', e.target.value)}
                          />
                        </Grid>
                      </Grid>
                    </Card>
                  ))}
                  <Box>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<Iconify icon="mingcute:add-line" />}
                      disabled={cuentas.length >= MAXIMO_DE_CUENTAS}
                      onClick={agregarCuenta}
                    >
                      Agregar otra cuenta
                    </Button>
                  </Box>
                </Stack>
              </Bloque>

              {/* -------- PayPal -------- */}
              <Bloque
                icono="payments:paypal"
                titulo="PayPal"
                texto="Cobra en dólares con la tasa de abajo. El Client ID y la clave salen de developer.paypal.com (Apps & Credentials)."
              >
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.paypal.activo}
                        onChange={(e) => cambiar('paypal.activo', e.target.checked)}
                      />
                    }
                    label={config.paypal.activo ? 'PayPal activo' : 'PayPal apagado'}
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        type="email"
                        label="Correo de la cuenta PayPal"
                        value={config.paypal.correo}
                        onChange={(e) => cambiar('paypal.correo', e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        fullWidth
                        label="Modo"
                        value={config.paypal.modo}
                        onChange={(e) => cambiar('paypal.modo', e.target.value)}
                        helperText={
                          config.paypal.modo === 'live'
                            ? 'Cobros reales'
                            : 'Pruebas (sandbox): no cobra'
                        }
                      >
                        <MenuItem value="sandbox">Pruebas (sandbox)</MenuItem>
                        <MenuItem value="live">Real (live)</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={12}>
                      {/* Siempre oculto (••••): se reemplaza pegando el nuevo, no se revela. */}
                      <TextField
                        fullWidth
                        label="Client ID"
                        type="password"
                        autoComplete="off"
                        value={config.paypal.clientId}
                        onChange={(e) => cambiar('paypal.clientId', e.target.value)}
                      />
                    </Grid>
                  </Grid>

                  <Card variant="outlined" sx={{ p: 2, bgcolor: 'background.neutral' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                      <Iconify icon="solar:lock-password-outline" />
                      <Typography variant="subtitle2">Clave secreta y webhook</Typography>
                      {secretos && !secretos.error && (
                        <Label color={secretos.claveSecretaConfigurada ? 'success' : 'warning'}>
                          {secretos.claveSecretaConfigurada ? 'Clave guardada' : 'Sin clave'}
                        </Label>
                      )}
                    </Stack>
                    <Typography
                      variant="caption"
                      component="p"
                      sx={{ color: 'text.secondary', mb: 1.5 }}
                    >
                      La clave nunca se vuelve a mostrar: se guarda en el servidor. Déjala vacía
                      para conservar la que hay.
                    </Typography>
                    {secretos?.error ? (
                      <Alert severity="warning">
                        Solo el Administrador Global y la Oficina Nacional (como rol principal)
                        pueden cambiar la clave de PayPal.
                      </Alert>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="password"
                            autoComplete="new-password"
                            label="Clave secreta (Secret)"
                            // Guardada, se ve como ••••: escribir una nueva la reemplaza.
                            placeholder={
                              secretos?.claveSecretaConfigurada ? '••••••••••••••••••••' : ''
                            }
                            value={claveSecreta}
                            // Con el rótulo arriba, los puntos de la clave guardada se ven.
                            slotProps={{ inputLabel: { shrink: true } }}
                            onChange={(e) => setClaveSecreta(e.target.value)}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Webhook ID"
                            value={webhookId}
                            onChange={(e) => setWebhookId(e.target.value)}
                          />
                        </Grid>
                        <Grid size={12}>
                          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                            {secretos?.claveSecretaConfigurada && (
                              <Button
                                size="small"
                                color="error"
                                disabled={guardandoSecretos}
                                onClick={() => guardarPaypalSecreto({ borrar: true })}
                              >
                                Quitar clave
                              </Button>
                            )}
                            <LoadingButton
                              size="small"
                              variant="outlined"
                              loading={guardandoSecretos}
                              disabled={
                                !claveSecreta.trim() &&
                                webhookId.trim() === (secretos?.webhookId || '') &&
                                limpia.paypal.clientId === guardada.paypal.clientId
                              }
                              onClick={() => guardarPaypalSecreto()}
                            >
                              Guardar credenciales
                            </LoadingButton>
                          </Stack>
                        </Grid>
                      </Grid>
                    )}
                  </Card>
                </Stack>
              </Bloque>

              {/* -------- Tasa -------- */}
              <Bloque
                icono="solar:chart-square-outline"
                titulo="Tasa del dólar"
                texto="Cuántos pesos vale US$1. Pasados los días de vigencia sin actualizarla, PayPal se apaga solo."
              >
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.tasa.automatica}
                        onChange={(e) => cambiar('tasa.automatica', e.target.checked)}
                      />
                    }
                    label={
                      <Stack>
                        <Typography variant="body2">Tasa automática</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Al guardar se lee al momento y, desde mañana, cada día a las 6:00 a. m.;
                          se le resta el margen. Si falla, sigue la anterior y te avisa la campana.
                        </Typography>
                        {config.tasa.automatica && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Fuente:{' '}
                            <Box
                              component="a"
                              href={FUENTE_TASA_AUTOMATICA.web}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              sx={{ color: 'primary.main', fontWeight: 600 }}
                            >
                              {FUENTE_TASA_AUTOMATICA.nombre}
                            </Box>
                            , {FUENTE_TASA_AUTOMATICA.descripcion}. Si no responde, se usa la de
                            mercado de ExchangeRate-API y la lectura lo dice.
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                  <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      {config.tasa.automatica ? (
                        <TextField
                          fullWidth
                          type="number"
                          label="Margen"
                          value={config.tasa.margen}
                          onChange={(e) =>
                            cambiar(
                              'tasa.margen',
                              // Vacío mientras se escribe (antes volvía a 0 y no se podía
                              // borrar); al guardar, vacío cuenta como 0 %.
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          helperText="Cubre la conversión de PayPal."
                          slotProps={{
                            htmlInput: { min: 0, max: 20, step: 0.5 },
                            input: {
                              endAdornment: <InputAdornment position="end">%</InputAdornment>,
                            },
                          }}
                        />
                      ) : (
                        <TextField
                          fullWidth
                          type="number"
                          label="RD$ por US$1"
                          value={config.tasa.rdPorUsd ?? ''}
                          onChange={(e) =>
                            cambiar(
                              'tasa.rdPorUsd',
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                          helperText=" "
                          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                        />
                      )}
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Tooltip
                        arrow
                        placement="top"
                        title="Cuántos días sirve una tasa después de actualizarla. Pasado ese tiempo sin una tasa nueva, PayPal se apaga solo para no cobrar con una tasa vieja. Con 1, la tasa sirve solo el día en que se actualizó."
                      >
                        <TextField
                          fullWidth
                          type="number"
                          label="Días de vigencia"
                          value={config.tasa.diasVigencia}
                          onChange={(e) => cambiar('tasa.diasVigencia', Number(e.target.value))}
                          helperText=" "
                          slotProps={{
                            htmlInput: { min: 1, max: 31 },
                            input: {
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Iconify
                                    icon="solar:info-circle-bold"
                                    width={18}
                                    sx={{ color: 'text.disabled' }}
                                  />
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Tooltip>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      {guardada.tasa.fecha ? (
                        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                          <Label color={tasaHoy ? 'success' : 'error'}>
                            {tasaHoy ? 'Vigente' : 'Vencida'}
                          </Label>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Actualizada el{' '}
                            {guardada.tasa.leidaEn
                              ? dayjs(guardada.tasa.leidaEn).format('DD/MM/YYYY hh:mm A')
                              : formatearFechaIso(guardada.tasa.fecha)}
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Sin tasa guardada.
                        </Typography>
                      )}
                    </Grid>
                  </Grid>

                  {/* La última lectura automática: de dónde, cuándo y si falló. */}
                  {guardada.tasa.automatica && (
                    <Alert
                      severity={guardada.tasa.ultimoError ? 'warning' : 'info'}
                      icon={<Iconify icon="solar:restart-bold" />}
                      action={
                        <LoadingButton
                          size="small"
                          color="inherit"
                          loading={leyendoTasa}
                          disabled={hayCambios}
                          onClick={actualizarTasa}
                        >
                          Actualizar ahora
                        </LoadingButton>
                      }
                    >
                      {guardada.tasa.leidaEn ? (
                        <>
                          Última lectura: RD${guardada.tasa.base} por US$1 el{' '}
                          {dayjs(guardada.tasa.leidaEn).format('DD/MM/YYYY hh:mm A')}, de{' '}
                          {guardada.tasa.fuente}. Con {guardada.tasa.margen} % de margen se cobra a
                          RD${guardada.tasa.rdPorUsd}.
                        </>
                      ) : (
                        'Aún no se ha leído: pulsa «Actualizar ahora» o espera a las 6:00 a. m.'
                      )}
                      {guardada.tasa.ultimoError && (
                        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                          Último fallo ({guardada.tasa.fallosSeguidos} seguido
                          {guardada.tasa.fallosSeguidos === 1 ? '' : 's'}):{' '}
                          {guardada.tasa.ultimoError}
                        </Box>
                      )}
                    </Alert>
                  )}

                  {limpia.tasa.rdPorUsd && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Con esta tasa:{' '}
                      {IDS_DE_PLANES.map(
                        (id) =>
                          `${formatearRd(planes[id].precio)} = US$${aDolares(planes[id].precio, limpia.tasa.rdPorUsd)}`
                      ).join(' · ')}
                    </Typography>
                  )}
                </Stack>
              </Bloque>

              {/* -------- Avisos -------- */}
              <Bloque
                icono="solar:letter-bold"
                titulo="Correos"
                texto="El de avisos recibe copia de cada membresía confirmada y de cada depósito rechazado."
              >
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Correo de avisos"
                      value={config.correoAvisos}
                      onChange={(e) => cambiar('correoAvisos', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Correo remitente"
                      value={config.correoRemitente}
                      onChange={(e) => cambiar('correoRemitente', e.target.value)}
                      helperText="Desde dónde salen los correos de la landing"
                    />
                  </Grid>
                </Grid>
              </Bloque>

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<Iconify icon="solar:restart-bold" />}
                  onClick={() =>
                    setConfig({
                      ...sanearConfiguracionMembresia(CONFIGURACION_MEMBRESIA_DE_FABRICA),
                      cuentas: config.cuentas,
                      paypal: config.paypal,
                      tasa: config.tasa,
                      licencias: config.licencias,
                      correoAvisos: config.correoAvisos,
                      correoRemitente: config.correoRemitente,
                    })
                  }
                >
                  Montos y planes de fábrica
                </Button>
                <LoadingButton
                  variant="contained"
                  loading={guardando}
                  disabled={!hayCambios}
                  onClick={guardar}
                >
                  {hayCambios ? 'Guardar cambios' : 'Guardado'}
                </LoadingButton>
              </Stack>
            </Stack>
          )}
        </Box>
      </Collapse>
    </Card>
  );
}
