import dayjs from 'dayjs';
import { varAlpha } from 'minimal-shared/utils';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ToggleButton from '@mui/material/ToggleButton';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { formatearRd } from 'src/utils/membresia-onerrd.mjs';
import { nombreCortoPersona } from 'src/utils/reporte-registro-membresia.mjs';

import {
  leerPagosMembresia,
  leerComprobanteMembresia,
  enviarDocumentosMembresia,
  leerConfiguracionMembresia,
} from 'src/services/membresia-onerrd-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { Inscritos2026 } from './inscritos-2026';
import { TituloDesplegable } from './factura-editor';
import { EstadoMembresia } from './estado-membresia';
import { ReporteRegistroMembresia } from './membresia-reporte';

// ----------------------------------------------------------------------
// "MEMBRESÍAS 2027 · PAGOS": lo que entra por la landing. Avance por región o
// sección (con los destacamentos listos y los que faltan), y cada pago: fecha
// y hora, destacamento, plan, si fue PayPal o transferencia, su estado (las
// transferencias quedan "En revisión" hasta que la Oficina Nacional las
// valide), el comprobante en una ventana flotante, a qué correo salieron el
// certificado y la factura y si llegaron. Desde cada fila se abre el diseño
// del certificado y de la factura con los datos de ese destacamento.
// Datos por /api/certificados-onerrd/membresia/pagos (Admin SDK).
// ----------------------------------------------------------------------

export const ESTADOS_PAGO = {
  confirmada: { etiqueta: 'Pagado', color: 'success', icono: 'solar:check-circle-bold' },
  pendiente_transferencia: {
    etiqueta: 'En revisión',
    color: 'warning',
    icono: 'solar:clock-circle-bold',
  },
  pendiente_paypal: {
    etiqueta: 'Esperando PayPal',
    color: 'info',
    icono: 'solar:clock-circle-bold',
  },
  pendiente_revision: {
    etiqueta: 'Pagado · revisar datos',
    color: 'warning',
    icono: 'solar:pen-bold',
  },
  rechazada: { etiqueta: 'Rechazado', color: 'error', icono: 'solar:close-circle-bold' },
};

const ESTADOS_CORREO = {
  enviado: { etiqueta: 'Enviado', color: 'success', icono: 'solar:check-circle-bold' },
  fallido: { etiqueta: 'Falló', color: 'error', icono: 'solar:danger-triangle-bold' },
  sin_configurar: { etiqueta: 'Sin configurar', color: 'default', icono: 'solar:info-circle-bold' },
};

const FILTROS = [
  ['todas', 'Todas'],
  ['pendiente_transferencia', 'En revisión'],
  ['confirmada', 'Pagadas'],
  ['paypal', 'PayPal'],
  ['transferencia', 'Transferencia'],
  ['pendiente_revision', 'Datos corregidos'],
  ['rechazada', 'Rechazadas'],
];

const fechaHora = (iso) => (iso ? dayjs(iso).format('DD/MM/YYYY hh:mm A') : '—');

const numeroDe = (d) => (d?.numero ? `#${d.numero}` : '');

// ---------------------------------------------------------------------- avance

function Avance({ padron, membresias }) {
  const [agrupar, setAgrupar] = useState('region');
  const [abierto, setAbierto] = useState(null);

  const grupos = useMemo(() => {
    const estadoPorId = new Map(membresias.map((m) => [String(m.id), m.estado]));
    const mapa = new Map();
    // Cuentan los activos y, como un inactivo también paga, los inactivos que
    // ya tienen su membresía en trámite o pagada.
    padron.forEach((d) => {
      if (d.estado && d.estado !== 'activo' && !estadoPorId.has(String(d.id))) return;
      const clave = d[agrupar] || 'Sin asignar';
      if (!mapa.has(clave)) mapa.set(clave, { clave, listos: [], revision: [], faltan: [] });
      const estado = estadoPorId.get(String(d.id));
      const grupo = mapa.get(clave);
      if (estado === 'confirmada') grupo.listos.push(d);
      else if (
        ['pendiente_transferencia', 'pendiente_paypal', 'pendiente_revision'].includes(estado)
      )
        grupo.revision.push(d);
      else grupo.faltan.push(d);
    });
    return [...mapa.values()]
      .map((g) => {
        const total = g.listos.length + g.revision.length + g.faltan.length;
        return { ...g, total, porcentaje: total ? (g.listos.length / total) * 100 : 0 };
      })
      .sort((a, b) => a.clave.localeCompare(b.clave, 'es'));
  }, [padron, membresias, agrupar]);

  const totales = grupos.reduce(
    (t, g) => ({ total: t.total + g.total, listos: t.listos + g.listos.length }),
    { total: 0, listos: 0 }
  );

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ mb: 1.5, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="subtitle1">
          Avance: {totales.listos} de {totales.total} destacamentos (
          {totales.total ? ((totales.listos / totales.total) * 100).toFixed(1) : '0.0'} %)
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={agrupar}
          onChange={(_, v) => {
            if (v) {
              setAgrupar(v);
              setAbierto(null);
            }
          }}
        >
          <ToggleButton value="region">Por región</ToggleButton>
          <ToggleButton value="seccion">Por sección</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <TableContainer sx={{ maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{agrupar === 'region' ? 'Región' : 'Sección'}</TableCell>
              <TableCell align="center">Total</TableCell>
              <TableCell align="center">Pagados</TableCell>
              <TableCell align="center">En revisión</TableCell>
              <TableCell align="center">Faltan</TableCell>
              <TableCell sx={{ width: '30%' }}>Cumplimiento</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {grupos.map((g) => (
              <FilaGrupo
                key={g.clave}
                grupo={g}
                abierto={abierto === g.clave}
                onAlternar={() => setAbierto((a) => (a === g.clave ? null : g.clave))}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function ListaDeDestacamentos({ titulo, lista, color }) {
  if (!lista.length) return null;
  return (
    <Box>
      <Typography variant="caption" sx={{ color: `${color}.dark`, fontWeight: 700 }}>
        {titulo} ({lista.length})
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
        {lista
          .slice()
          .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0))
          .map((d) => (
            <Chip
              key={d.id}
              size="small"
              color={color}
              variant="soft"
              label={`${d.numero ? `#${d.numero} ` : ''}${d.nombre}`}
            />
          ))}
      </Stack>
    </Box>
  );
}

function FilaGrupo({ grupo, abierto, onAlternar }) {
  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer' }} onClick={onAlternar}>
        <TableCell sx={{ fontWeight: 600 }}>{grupo.clave}</TableCell>
        <TableCell align="center">{grupo.total}</TableCell>
        <TableCell align="center" sx={{ color: 'success.dark', fontWeight: 600 }}>
          {grupo.listos.length}
        </TableCell>
        <TableCell align="center" sx={{ color: 'warning.dark', fontWeight: 600 }}>
          {grupo.revision.length}
        </TableCell>
        <TableCell align="center" sx={{ color: 'error.main', fontWeight: 600 }}>
          {grupo.faltan.length}
        </TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <LinearProgress
              variant="determinate"
              color="success"
              value={grupo.porcentaje}
              sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
              {grupo.porcentaje.toFixed(1)} %
            </Typography>
          </Stack>
        </TableCell>
        <TableCell padding="checkbox">
          <Tooltip title={abierto ? 'Ocultar destacamentos' : 'Ver listos y faltantes'}>
            <IconButton size="small">
              <Iconify
                icon={abierto ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
              />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, borderBottom: abierto ? undefined : 'none' }}>
          <Collapse in={abierto} unmountOnExit>
            <Stack spacing={1.5} sx={{ py: 1.5 }}>
              <ListaDeDestacamentos titulo="Listos" lista={grupo.listos} color="success" />
              <ListaDeDestacamentos titulo="En revisión" lista={grupo.revision} color="warning" />
              <ListaDeDestacamentos titulo="Faltan" lista={grupo.faltan} color="error" />
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ---------------------------------------------------------------------- comprobante

function VentanaComprobante({ membresia, onCerrar }) {
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!membresia) return undefined;
    let url = '';
    setArchivo(null);
    setError('');
    leerComprobanteMembresia(membresia.id)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setArchivo({ url, tipo: blob.type });
      })
      .catch((e) => setError(e.message));
    return () => url && URL.revokeObjectURL(url);
  }, [membresia]);

  const d = membresia?.destacamento;
  return (
    <Dialog open={!!membresia} onClose={onCerrar} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        Comprobante · {numeroDe(d)} {d?.nombre}
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {membresia?.deposito?.fecha &&
            `Depósito del ${dayjs(membresia.deposito.fecha).format('DD/MM/YYYY')}`}
          {membresia?.deposito?.referencia && ` · Ref. ${membresia.deposito.referencia}`}
          {membresia?.montoRd != null &&
            ` · ${formatearRd(membresia.montoRd, { decimales: true })}`}
        </Typography>
        <IconButton onClick={onCerrar} sx={{ position: 'absolute', top: 12, right: 12 }}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        {!archivo && !error && <Skeleton variant="rounded" height={420} />}
        {archivo?.tipo === 'application/pdf' && (
          <Box
            component="iframe"
            title="Comprobante"
            src={archivo.url}
            sx={{ width: 1, height: '70vh', border: 0 }}
          />
        )}
        {archivo && archivo.tipo !== 'application/pdf' && (
          <Box
            component="img"
            alt="Comprobante del depósito"
            src={archivo.url}
            sx={{ display: 'block', maxWidth: 1, maxHeight: '70vh', mx: 'auto', borderRadius: 1 }}
          />
        )}
        {archivo && (
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
            <Button
              href={archivo.url}
              // Al cerrar, `membresia` pasa a null antes de que se vaya el archivo.
              download={`comprobante-${d?.numero || membresia?.id || ''}`}
              startIcon={<Iconify icon="solar:download-bold" />}
            >
              Descargar
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------- correo

function EstadoCorreo({ correo, onReintentar, reintentando }) {
  const [ancla, setAncla] = useState(null);
  if (!correo && !onReintentar) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        Aún no enviado
      </Typography>
    );
  }
  // Emitido pero sin envío registrado: se enseña como «Sin enviar» y se puede enviar.
  const e = correo
    ? ESTADOS_CORREO[correo.estado] || ESTADOS_CORREO.sin_configurar
    : { color: 'default', icono: 'solar:clock-circle-bold', etiqueta: 'Sin enviar' };
  const reintentable = Boolean(onReintentar) && correo?.estado !== 'enviado';
  const chip = (
    <Label
      color={e.color}
      startIcon={<Iconify icon={reintentando ? 'solar:restart-bold' : e.icono} />}
      endIcon={reintentable ? <Iconify icon="eva:arrow-ios-downward-fill" width={14} /> : null}
      sx={{ alignSelf: 'flex-start' }}
    >
      {reintentando ? 'Enviando…' : e.etiqueta}
    </Label>
  );
  return (
    <Tooltip
      placement="top-start"
      // Con el menú abierto, el tip se quita (título vacío): se pintaba encima
      // del menú y no dejaba verlo ni pulsarlo.
      title={
        ancla
          ? ''
          : [
              correo?.desde && `Desde: ${correo.desde}`,
              correo?.copia && `Copia: ${correo.copia}`,
              correo?.enviadoEn && fechaHora(correo.enviadoEn),
              correo?.error,
            ]
              .filter(Boolean)
              .join(' · ')
      }
    >
      <Stack spacing={0.25}>
        <Typography variant="caption" noWrap sx={{ maxWidth: 200 }}>
          {correo?.para || '—'}
        </Typography>
        {reintentable ? (
          <>
            <ButtonBase
              disabled={reintentando}
              onClick={(ev) => setAncla(ev.currentTarget)}
              sx={{ alignSelf: 'flex-start', borderRadius: 0.75 }}
              aria-label="Opciones del envío"
            >
              {chip}
            </ButtonBase>
            <Menu anchorEl={ancla} open={!!ancla} onClose={() => setAncla(null)}>
              <MenuItem
                onClick={() => {
                  setAncla(null);
                  onReintentar();
                }}
              >
                <ListItemIcon>
                  <Iconify icon="solar:restart-bold" />
                </ListItemIcon>
                Reintentar envío
              </MenuItem>
            </Menu>
          </>
        ) : (
          chip
        )}
      </Stack>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------- principal

export function MembresiaOnerrdPagos({
  abierto,
  onAlternar,
  onEditar,
  onConfirmada,
  version = 0,
  user,
}) {
  const [datos, setDatos] = useState(null);
  const [remitente, setRemitente] = useState('');
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [comprobante, setComprobante] = useState(null);
  const [recargando, setRecargando] = useState(false);
  const [reenviando, setReenviando] = useState('');
  const [reporteAbierto, setReporteAbierto] = useState(false);
  const [inscritosAbierto, setInscritosAbierto] = useState(false);

  const cargar = useCallback(async ({ forzar = false } = {}) => {
    setRecargando(true);
    setError('');
    try {
      setDatos(await leerPagosMembresia(forzar ? Date.now() : undefined));
    } catch (e) {
      setError(e.message);
    } finally {
      setRecargando(false);
    }
  }, []);

  // Se piden al montar la pestaña: al abrir, ya están.
  useEffect(() => {
    cargar();
    leerConfiguracionMembresia()
      .then((c) => setRemitente(c.correoRemitente))
      .catch(() => {});
  }, [cargar]);

  // Tras emitir solo al confirmar: se vuelve a leer para enseñar el envío.
  useEffect(() => {
    if (version) cargar({ forzar: true });
  }, [version, cargar]);

  // "Reintentar envío": el servidor toma el certificado y la factura ya
  // guardados y los manda otra vez; la fila se actualiza con el resultado.
  const reenviar = async (m) => {
    setReenviando(m.id);
    try {
      const { registro, membresia } = await enviarDocumentosMembresia({
        id: m.id,
        numeroRegistro: m.certificadoEmitido?.numeroRegistro,
        facturaNumero: m.certificadoEmitido?.facturaNumero,
      });
      setDatos((actual) => ({
        ...actual,
        membresias: actual.membresias.map((x) => (x.id === m.id ? membresia : x)),
      }));
      if (registro.estado === 'enviado') toast.success(`Enviado a ${registro.para}.`);
      else toast.error(registro.error || 'No se pudo enviar el correo.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setReenviando('');
    }
  };

  const membresias = useMemo(() => datos?.membresias || [], [datos]);
  const cuenta = useMemo(() => {
    const c = { confirmada: 0, pendiente_transferencia: 0, pendiente_paypal: 0, rechazada: 0 };
    membresias.forEach((m) => {
      c[m.estado] = (c[m.estado] || 0) + 1;
    });
    return c;
  }, [membresias]);

  const correos = useMemo(() => {
    const lista = membresias.map((m) => m.correos?.confirmacion).filter(Boolean);
    return {
      enviados: lista.filter((c) => c.estado === 'enviado').length,
      fallidos: lista.filter((c) => c.estado !== 'enviado').length,
      desdeUltimo: lista.find((c) => c.desde)?.desde || '',
    };
  }, [membresias]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase().replace(/^#/, '');
    return membresias.filter((m) => {
      if (filtro === 'paypal' || filtro === 'transferencia') {
        if (m.tipoPago !== filtro) return false;
      } else if (filtro !== 'todas' && m.estado !== filtro) return false;
      if (!q) return true;
      const d = m.destacamento || {};
      return `${d.numero} ${d.nombre} ${d.region} ${d.seccion} ${m.codigo}`
        .toLowerCase()
        .includes(q);
    });
  }, [membresias, filtro, busqueda]);

  const desde = remitente || correos.desdeUltimo;

  return (
    <Card
      sx={(t) => ({
        p: { xs: 2, md: 2.5 },
        minWidth: 0,
        border: `1px solid ${varAlpha(t.vars.palette.success.mainChannel, 0.32)}`,
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <Iconify icon="solar:wad-of-money-bold" sx={{ color: 'success.main' }} />
        <TituloDesplegable
          titulo="Membresías 2027 · pagos"
          abierto={abierto}
          onAlternar={onAlternar}
        />
        {datos && (
          <>
            <Label color="success">{cuenta.confirmada} pagadas</Label>
            {cuenta.pendiente_transferencia > 0 && (
              <Label color="warning">{cuenta.pendiente_transferencia} en revisión</Label>
            )}
          </>
        )}
        {abierto && (
          <Tooltip title="Volver a leer">
            <span>
              <IconButton
                size="small"
                disabled={recargando}
                onClick={() => cargar({ forzar: true })}
              >
                <Iconify icon="solar:restart-bold" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Button
          size="small"
          variant="outlined"
          onClick={() => setReporteAbierto(true)}
          disabled={!datos}
          startIcon={<Iconify icon="solar:document-text-bold" />}
          sx={{ ml: 'auto' }}
        >
          Ver reporte registro
        </Button>
        {/* Los inscritos de 2026: a ellos les toca el descuento por fidelidad. */}
        <Button
          size="small"
          variant="outlined"
          onClick={() => setInscritosAbierto(true)}
          startIcon={<Iconify icon="solar:users-group-rounded-bold" />}
        >
          Inscripción destacamentos anteriores
        </Button>
      </Stack>

      <Inscritos2026
        abierto={inscritosAbierto}
        onCerrar={() => setInscritosAbierto(false)}
        padron={datos?.padron || []}
        user={user}
      />

      <ReporteRegistroMembresia
        abierto={reporteAbierto}
        onCerrar={() => setReporteAbierto(false)}
        membresias={datos?.membresias || []}
        padron={datos?.padron || []}
      />

      <Collapse in={abierto}>
        <Stack spacing={3} sx={{ mt: 2.5 }}>
          {recargando && <LinearProgress color="success" />}
          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity={desde ? 'info' : 'warning'} icon={<Iconify icon="solar:letter-bold" />}>
            {desde ? (
              <>
                Los correos salen desde <strong>{desde}</strong>.{' '}
                {correos.enviados + correos.fallidos > 0 &&
                  `${correos.enviados} enviados correctamente${correos.fallidos ? `, ${correos.fallidos} sin enviar` : ''}.`}
              </>
            ) : (
              'Aún no hay correo remitente: ponlo en «Membresía 2027 · landing» → Correos.'
            )}
          </Alert>

          {!datos && !error && <Skeleton variant="rounded" height={220} />}

          {datos && (
            <>
              <Avance padron={datos.padron || []} membresias={membresias} />

              <Box>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  sx={{ mb: 1.5, alignItems: { md: 'center' } }}
                >
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    Pagos ({visibles.length})
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="Número o nombre"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Iconify icon="eva:search-fill" />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    select
                    size="small"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    sx={{ minWidth: 170 }}
                  >
                    {FILTROS.map(([v, t]) => (
                      <MenuItem key={v} value={v}>
                        {t}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TableContainer sx={{ maxHeight: 560 }}>
                  <Table size="small" stickyHeader sx={{ minWidth: 980 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha y hora</TableCell>
                        <TableCell>Destacamento</TableCell>
                        <TableCell>Plan</TableCell>
                        <TableCell>Pago</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell>Certificado y factura enviados a</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!visibles.length && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <Typography
                              variant="body2"
                              sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}
                            >
                              {membresias.length
                                ? 'Ningún pago con ese filtro.'
                                : 'Aún no hay pagos.'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {visibles.map((m) => {
                        const estado =
                          ESTADOS_PAGO[m.estado] || ESTADOS_PAGO.pendiente_transferencia;
                        const d = m.destacamento || {};
                        return (
                          <TableRow key={m.id} hover>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {fechaHora(m.creadoEn)}
                              {m.confirmadoEn && (
                                <Typography
                                  variant="caption"
                                  component="p"
                                  sx={{ color: 'success.dark' }}
                                >
                                  Pagado {fechaHora(m.confirmadoEn)}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="subtitle2">
                                {numeroDe(d)} {d.nombre}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {[d.region, d.seccion].filter(Boolean).join(' · ')}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{m.plan?.nombre || '—'}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {m.montoRd != null
                                  ? formatearRd(m.montoRd, { decimales: true })
                                  : ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Label
                                color={m.tipoPago === 'paypal' ? 'info' : 'default'}
                                startIcon={
                                  <Iconify
                                    icon={
                                      m.tipoPago === 'paypal'
                                        ? 'payments:paypal'
                                        : 'solar:transfer-horizontal-bold-duotone'
                                    }
                                  />
                                }
                              >
                                {m.tipoPago === 'paypal' ? 'PayPal' : 'Transferencia'}
                              </Label>
                              {m.tipoPago === 'paypal' && m.paypal?.montoUsd && (
                                <Typography
                                  variant="caption"
                                  component="p"
                                  sx={{ color: 'text.secondary' }}
                                >
                                  US${m.paypal.montoUsd}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <EstadoMembresia
                                membresia={m}
                                estado={estado}
                                user={user}
                                // La fila cambia al momento con lo que devolvió el servidor.
                                onCambiado={(nueva) => {
                                  if (!nueva) return;
                                  setDatos((actual) => ({
                                    ...actual,
                                    membresias: actual.membresias.map((x) =>
                                      x.id === nueva.id ? nueva : x
                                    ),
                                  }));
                                  // Confirmado: certificado, factura y correo, solos.
                                  if (nueva.estado === 'confirmada') onConfirmada?.(nueva);
                                }}
                              />
                              {m.codigo && (
                                <Typography variant="caption" component="p">
                                  {m.codigo}
                                </Typography>
                              )}
                              {Object.keys(m.correcciones || {}).length > 0 && (
                                <Tooltip
                                  title={[
                                    ...Object.entries(m.correcciones).map(
                                      ([campo, c]) =>
                                        `${campo}: «${c.antes || '—'}» → «${c.despues || '—'}»`
                                    ),
                                    m.corregidoPor &&
                                      `Corrigió: ${m.corregidoPor.nombre}${m.corregidoPor.telefono ? ` · ${m.corregidoPor.telefono}` : ''}`,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                >
                                  <Typography
                                    variant="caption"
                                    component="p"
                                    sx={{ color: 'warning.dark', cursor: 'help' }}
                                  >
                                    {Object.keys(m.correcciones).length} dato(s) corregido(s)
                                  </Typography>
                                </Tooltip>
                              )}
                              {m.motivoRechazo && (
                                <Typography
                                  variant="caption"
                                  component="p"
                                  sx={{ color: 'error.main' }}
                                >
                                  {m.motivoRechazo}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {/* Quién registró el destacamento: primer nombre y primer apellido. */}
                              {m.registradoPor?.nombre && (
                                <Tooltip title={`Registrado por ${m.registradoPor.nombre}`}>
                                  <Typography variant="subtitle2" noWrap sx={{ maxWidth: 200 }}>
                                    {nombreCortoPersona(m.registradoPor)}
                                  </Typography>
                                </Tooltip>
                              )}
                              <EstadoCorreo
                                correo={m.correos?.confirmacion}
                                // Con el certificado ya emitido, un envío que falló (o que nunca
                                // salió) se reintenta desde el mismo chip.
                                onReintentar={
                                  m.estado === 'confirmada' && m.certificadoEmitido?.numeroRegistro
                                    ? () => reenviar(m)
                                    : null
                                }
                                reintentando={reenviando === m.id}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {m.deposito?.tieneComprobante && (
                                <Tooltip title="Ver comprobante">
                                  <IconButton onClick={() => setComprobante(m)}>
                                    <Iconify icon="solar:bill-list-bold" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Ver y editar certificado y factura">
                                <IconButton color="primary" onClick={() => onEditar?.(m)}>
                                  <Iconify icon="solar:pen-bold" />
                                </IconButton>
                              </Tooltip>
                              {m.certificadoEmitido?.numeroRegistro && (
                                <Typography
                                  variant="caption"
                                  component="p"
                                  sx={{ color: 'text.secondary' }}
                                >
                                  Emitido {m.certificadoEmitido.numeroRegistro}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </>
          )}
        </Stack>
      </Collapse>

      <VentanaComprobante membresia={comprobante} onCerrar={() => setComprobante(null)} />
    </Card>
  );
}
