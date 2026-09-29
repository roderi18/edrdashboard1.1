'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { textoPersonasCreadas } from 'src/utils/personas-del-envio.mjs';
import { puedeRevisarActualizacionesDeDestacamentos } from 'src/utils/org-level-access';
import { textoRepetido, repeticionesPorEnvio } from 'src/utils/actualizaciones-repetidas.mjs';

import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import {
  ESTADOS_ACTUALIZACION,
  cargarActualizaciones,
  cambiarCargaAutomatica,
  escucharCargaAutomatica,
  descartarActualizaciones,
  escucharActualizacionesDeDestacamentos,
} from 'src/services/actualizaciones-destacamentos-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { useAuthContext } from 'src/auth/hooks';

import { CargaPorCamposDialog } from '../carga-por-campos-dialog';
import { ResolverDestacamentoNuevo } from '../resolver-destacamento-nuevo';
import { CuentaRegresivaLandingCard } from '../cuenta-regresiva-landing-card';

// ----------------------------------------------------------------------
// BANDEJA "ACTUALIZACIÓN DE DESTACAMENTOS".
//
// Aquí llega lo que los directivos registran o corrigen desde la landing
// externa. Nada de esto está en el padrón: se revisa primero y luego se decide
// si se carga o se descarta: se marcan con la casilla los que de verdad deben
// entrar en la aplicación. Los ya cargados también se pueden marcar y volver a
// cargar (por si la primera carga salió mal): la carga compara con lo que hay
// en la aplicación y solo escribe lo que difiere. Los descartados, no.
// ----------------------------------------------------------------------

const COLOR_ESTADO = {
  [ESTADOS_ACTUALIZACION.pendiente]: 'warning',
  [ESTADOS_ACTUALIZACION.cargada]: 'success',
  [ESTADOS_ACTUALIZACION.descartada]: 'default',
};

const TEXTO_ESTADO = {
  [ESTADOS_ACTUALIZACION.pendiente]: 'Pendiente',
  [ESTADOS_ACTUALIZACION.cargada]: 'Cargada',
  [ESTADOS_ACTUALIZACION.descartada]: 'Descartada',
};

const fechaCorta = (fecha) =>
  fecha
    ? fecha.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '—';

const destacamentoDe = (fila) =>
  [
    fila.nombreDestacamento || fila.destacamento?.nombre,
    fila.numeroDestacamento || fila.destacamento?.numero,
  ]
    .filter(Boolean)
    .join(' ') || 'Destacamento nuevo';

// A qué ficha lleva cada nombre de la tabla. El destacamento nuevo aún no
// tiene ficha; quien envía, sí en cuanto existe (o la carga lo creó o lo halló).
const idDestacamentoDe = (fila) => (fila.esNuevo ? null : fila.destacamento?.id || null);
const idEnviadorDe = (fila) =>
  fila.enviadoPor?.idMiembro || fila.idsPersonas?.enviador || fila.personasCreadas?.enviador?.idMiembro || null;

// Un nombre que lleva a su ficha, o solo el texto si no hay ficha a la que ir.
function EnlaceAFicha({ href, children }) {
  if (!href) return children;
  return (
    <Link component={RouterLink} href={href} color="inherit" underline="hover" sx={{ fontWeight: 600 }}>
      {children}
    </Link>
  );
}

// Las mismas columnas de la tabla, para que el Excel diga lo mismo que la pantalla.
// TODO lo que llena el directivo en la landing, una columna por campo, para
// revisarlo completo en el Excel. La tabla de la pantalla muestra solo lo
// principal; el Excel es la ficha entera de cada envío.
const d = (fila) => fila.datos || {};
// Id de casilla ("seccional-sub-coordinador-seccional") → su nombre.
const nombreDeCargo = (valor) =>
  !valor || valor === 'none'
    ? valor === 'none'
      ? 'Ninguna'
      : ''
    : DIRECTIVA_POSITIONS.find((p) => p.idPosicionDirectiva === valor)?.nombreCargo || valor;
const siNo = (v) => (v === true ? 'Sí' : v === false ? 'No' : '');
const persona = (p = {}) => p.nombre || [p.nombres, p.apellidos].filter(Boolean).join(' ') || '';

const COLUMNAS = [
  { titulo: 'Recibida', valor: (fila) => fechaCorta(fila.fechaEnvio), ancho: 18 },
  { titulo: 'Estado', valor: (fila) => TEXTO_ESTADO[fila.estado] || fila.estado || '', ancho: 12 },
  {
    titulo: 'Tipo',
    valor: (fila) => (fila.esNuevo ? 'Destacamento nuevo' : 'Actualización'),
    ancho: 18,
  },
  // Quién lo envió
  { titulo: 'Enviado por', valor: (fila) => fila.enviadoPor?.nombre || '', ancho: 26 },
  { titulo: 'Enviado por: posición', valor: (fila) => fila.enviadoPor?.posicion || '', ancho: 26 },
  { titulo: 'Enviado por: teléfono', valor: (fila) => fila.enviadoPor?.telefono || '', ancho: 16 },
  {
    titulo: 'Enviado por: ¿existe en la app?',
    valor: (fila) => (fila.enviadoPor?.esPersonaNueva ? 'No (persona nueva)' : 'Sí'),
    ancho: 18,
  },
  {
    titulo: 'Enviado por: id miembro',
    valor: (fila) => fila.enviadoPor?.idMiembro || '',
    ancho: 12,
  },
  { titulo: 'Enviado por: código', valor: (fila) => fila.enviadoPor?.codigoMiembro || '', ancho: 12 },
  // Destacamento
  { titulo: 'Id destacamento (app)', valor: (fila) => fila.destacamento?.id || '', ancho: 12 },
  {
    titulo: 'Nombre del destacamento',
    valor: (fila) => d(fila).nombre || fila.nombreDestacamento || '',
    ancho: 26,
  },
  { titulo: 'Número', valor: (fila) => d(fila).numero || fila.numeroDestacamento || '', ancho: 9 },
  { titulo: 'Región', valor: (fila) => fila.region?.nombre || '', ancho: 16 },
  { titulo: 'Sección', valor: (fila) => fila.seccion?.nombre || '', ancho: 22 },
  { titulo: 'Iglesia', valor: (fila) => d(fila).iglesia || '', ancho: 30 },
  {
    titulo: 'Cantidad aprox. de miembros',
    valor: (fila) => d(fila).cantidadMiembros ?? '',
    ancho: 12,
  },
  // Dirección
  { titulo: 'Provincia', valor: (fila) => d(fila).direccion?.provincia || '', ancho: 18 },
  { titulo: 'Municipio', valor: (fila) => d(fila).direccion?.municipio || '', ancho: 22 },
  { titulo: 'Sector', valor: (fila) => d(fila).direccion?.sector || '', ancho: 22 },
  { titulo: 'Calle y número', valor: (fila) => d(fila).direccion?.calle || '', ancho: 30 },
  { titulo: 'Referencia', valor: (fila) => d(fila).direccion?.referencia || '', ancho: 30 },
  // Líderes
  { titulo: 'Pastor', valor: (fila) => d(fila).pastor?.nombre || '', ancho: 26 },
  { titulo: 'Teléfono del pastor', valor: (fila) => d(fila).pastor?.telefono || '', ancho: 16 },
  {
    titulo: 'Coordinador de Destacamento',
    valor: (fila) => persona(d(fila).coordinador),
    ancho: 26,
  },
  {
    titulo: 'Coordinador: ¿existe en la app?',
    valor: (fila) => (d(fila).coordinador?.idMiembro ? 'Sí' : 'No (persona nueva)'),
    ancho: 18,
  },
  {
    titulo: 'Coordinador: id miembro',
    valor: (fila) => d(fila).coordinador?.idMiembro || '',
    ancho: 12,
  },
  {
    titulo: 'Coordinador: código',
    valor: (fila) => d(fila).coordinador?.codigoMiembro || '',
    ancho: 12,
  },
  {
    titulo: 'Teléfono del coordinador',
    valor: (fila) => d(fila).coordinador?.telefono || '',
    ancho: 16,
  },
  // Registro y reuniones
  {
    titulo: 'Registrado en Oficina Nacional',
    valor: (fila) => siNo(d(fila).registradoOfnc),
    ancho: 12,
  },
  { titulo: 'RRITrack activo', valor: (fila) => siNo(d(fila).rritrackActivo), ancho: 12 },
  { titulo: 'Día de reunión', valor: (fila) => d(fila).diaReunion || '', ancho: 12 },
  { titulo: 'Horario de reunión: desde', valor: (fila) => d(fila).horaReunion || '', ancho: 10 },
  // El padrón solo guarda la hora de inicio; la de fin se lee aquí.
  { titulo: 'Horario de reunión: hasta', valor: (fila) => d(fila).horaReunionFin || '', ancho: 10 },
  // Tus datos de miembro (quien envía). Vacío = no lo quiso cambiar.
  { titulo: 'Miembro: nombres', valor: (fila) => fila.miembro?.nombres || '', ancho: 20 },
  { titulo: 'Miembro: apellidos', valor: (fila) => fila.miembro?.apellidos || '', ancho: 20 },
  {
    titulo: 'Miembro: Nivel posición en tu Destacamento',
    valor: (fila) => nombreDeCargo(fila.miembro?.posicionDestacamento),
    ancho: 30,
  },
  {
    titulo: 'Miembro: foto nueva',
    valor: (fila) => (fila.fotoMiembro?.ruta ? `Sí (${fila.fotoMiembro.ruta})` : 'No'),
    ancho: 30,
  },
  {
    titulo: 'Cambios del miembro',
    valor: (fila) =>
      (fila.cambiosMiembro || [])
        .map((c) => `${c.campo}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`)
        .join('\n'),
    ancho: 60,
  },
  // Logo y cambios
  {
    titulo: 'Logo enviado',
    valor: (fila) => (fila.logo?.ruta ? `Sí (${fila.logo.ruta})` : 'No'),
    ancho: 30,
  },
  {
    titulo: 'Cambios respecto a lo registrado',
    valor: (fila) =>
      (fila.cambios || [])
        .map((c) => `${c.campo}: ${c.antes ?? '—'} → ${c.despues ?? '—'}`)
        .join('\n'),
    ancho: 60,
  },
  { titulo: 'Id del envío', valor: (fila) => fila.id, ancho: 22 },
];

// Detalle de un envío dentro de la tabla: lo mismo que el Excel, y arriba lo
// que cambia respecto a lo registrado, para decidir sin descargar nada.
const SIN_DETALLE = [
  'Recibida',
  'Estado',
  'Cambios respecto a lo registrado',
  'Cambios del miembro',
  'Id del envío',
];

function ListaDeCambios({ cambios }) {
  return (
    <Stack spacing={0.75} sx={{ mb: 2.5 }}>
      {cambios.map((c) => (
        <Typography key={c.campo} variant="body2">
          <Box component="span" sx={{ fontWeight: 600 }}>
            {c.campo}:
          </Box>{' '}
          <Box component="span" sx={{ color: 'error.main', textDecoration: 'line-through' }}>
            {String(c.antes ?? '—') || '—'}
          </Box>
          {'  →  '}
          <Box component="span" sx={{ color: 'success.dark', fontWeight: 600 }}>
            {String(c.despues ?? '—') || '—'}
          </Box>
        </Typography>
      ))}
    </Stack>
  );
}

function DetalleEnvio({ fila }) {
  // La hora llega como "10:00" y el padrón la guarda "10:00:00": no es un cambio.
  const cambios = (fila.cambios || []).filter(
    (c) =>
      !(c.campo === 'horaReunion' && String(c.antes ?? '').slice(0, 5) === String(c.despues ?? ''))
  );
  return (
    <Box sx={{ p: 2.5, bgcolor: 'background.neutral', borderRadius: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {fila.esNuevo
          ? 'Destacamento nuevo (no existe en la aplicación)'
          : 'Cambios respecto a lo registrado'}
      </Typography>
      {!fila.esNuevo && !cambios.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          No cambia nada de lo registrado.
        </Typography>
      )}
      {!!cambios.length && <ListaDeCambios cambios={cambios} />}
      {(!!fila.cambiosMiembro?.length || fila.fotoMiembro?.url) && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Cambios en los datos de {fila.enviadoPor?.nombre || 'quien envía'}
          </Typography>
          {fila.fotoMiembro?.url && (
            <Box
              component="img"
              alt="Foto nueva"
              src={fila.fotoMiembro.url}
              sx={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', mb: 1.5 }}
            />
          )}
          <ListaDeCambios cambios={fila.cambiosMiembro || []} />
        </>
      )}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Todo lo enviado
      </Typography>
      <Box
        sx={{
          display: 'grid',
          columnGap: 3,
          rowGap: 1,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {COLUMNAS.filter((c) => !SIN_DETALLE.includes(c.titulo)).map((c) => (
          <Box key={c.titulo}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {c.titulo}
            </Typography>
            <Typography variant="body2">{String(c.valor(fila) ?? '') || '—'}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ExcelJS se carga al pulsar: es grande y solo hace falta para descargar.
async function descargarExcel(filas) {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Actualizaciones');

  hoja.columns = COLUMNAS.map((columna) => ({ header: columna.titulo, width: columna.ancho }));
  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  filas.forEach((fila) => {
    const r = hoja.addRow(COLUMNAS.map((columna) => columna.valor(fila)));
    r.alignment = { wrapText: true, vertical: 'top' };
  });
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } };

  const blob = new Blob([await libro.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `actualizaciones-destacamentos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

// Lo que dice la bandeja al terminar una carga (completa o por campos).
function avisarResultado(resultado) {
  const {
    cargadas,
    omitidas,
    fallidas,
    iglesiasCreadas = [],
    iglesiasFallidas = [],
    personasCreadas = [],
    personasMovidas = [],
    telefonosPuestos = [],
    avisosPersonas = [],
  } = resultado;
  if (cargadas)
    toast.success(`${cargadas} cargada${cargadas === 1 ? '' : 's'} en la aplicación.`);
  if (omitidas.length)
    toast.warning(
      `Sin cargar (destacamento nuevo, créalo en Destacamentos): ${omitidas.join(', ')}`
    );
  if (fallidas.length) toast.error(`No se pudieron cargar: ${fallidas.join(', ')}`);
  // La iglesia (nombre, pastor, dirección) va aparte del destacamento.
  if (iglesiasCreadas.length)
    toast.info(
      `Iglesia nueva con los datos enviados (la API no deja editar la anterior): ${iglesiasCreadas.join(', ')}`
    );
  if (iglesiasFallidas.length)
    toast.error(`El destacamento se cargó, pero no su iglesia: ${iglesiasFallidas.join(', ')}`);
  // El coordinador y quien envía: altas nuevas y lo que no se pudo hacer.
  if (personasCreadas.length)
    toast.info(`Personas nuevas dadas de alta en: ${personasCreadas.join(', ')}`);
  if (personasMovidas.length)
    toast.info(`Pasan de Provisional a su destacamento: ${personasMovidas.join(', ')}`);
  if (telefonosPuestos.length)
    toast.info(`Teléfono puesto en la ficha de: ${telefonosPuestos.join(', ')}`);
  if (avisosPersonas.length)
    toast.warning(avisosPersonas.join(' · '), { duration: 15000 });
}

export function AdminActualizacionesDestacamentosView() {
  const { user } = useAuthContext();
  const puedeRevisar = puedeRevisarActualizacionesDeDestacamentos(user);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [elegidas, setElegidas] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [porCampos, setPorCampos] = useState(false);
  const repetidos = repeticionesPorEnvio(filas || []);

  // Se marcan las pendientes y también las cargadas, para volver a cargarlas.
  const marcables = (filas || []).filter(
    (f) =>
      f.estado === ESTADOS_ACTUALIZACION.pendiente || f.estado === ESTADOS_ACTUALIZACION.cargada
  );
  const pendientes = marcables;
  // Una elegida que otro descartó mientras tanto deja de contar.
  const seleccion = marcables.filter((f) => elegidas.includes(f.id));
  const hayRecargas = seleccion.some((f) => f.estado === ESTADOS_ACTUALIZACION.cargada);
  const alternar = (id) =>
    setElegidas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const alternarTodas = () =>
    setElegidas(seleccion.length === pendientes.length ? [] : pendientes.map((f) => f.id));

  const handleCargar = async () => {
    setTrabajando(true);
    try {
      avisarResultado(await cargarActualizaciones(seleccion, user));
      setElegidas([]);
    } catch (fallo) {
      console.error('[actualizaciones de destacamentos] no se pudieron cargar', fallo);
      toast.error(fallo.message || 'No se pudieron cargar.');
    } finally {
      setTrabajando(false);
    }
  };

  const handleDescartar = async () => {
    setTrabajando(true);
    try {
      await descartarActualizaciones(seleccion, user);
      toast.success('Descartadas.');
      setElegidas([]);
    } catch (fallo) {
      console.error('[actualizaciones de destacamentos] no se pudieron descartar', fallo);
      toast.error('No se pudieron descartar.');
    } finally {
      setTrabajando(false);
    }
  };

  const handleDescargar = async () => {
    setDescargando(true);
    try {
      await descargarExcel(filas || []);
    } catch (fallo) {
      console.error('[actualizaciones de destacamentos] no se pudo generar el Excel', fallo);
      toast.error('No se pudo descargar el Excel.');
    } finally {
      setDescargando(false);
    }
  };

  useEffect(() => {
    if (!puedeRevisar) return undefined;

    return escucharActualizacionesDeDestacamentos(setFilas, (fallo) => {
      console.error('[actualizaciones de destacamentos] no se pudieron leer', fallo);
      setError('No se pudieron leer las actualizaciones. Inténtalo de nuevo más tarde.');
      setFilas([]);
    });
  }, [puedeRevisar]);

  if (!puedeRevisar) {
    return (
      <Alert severity="info">
        Esta bandeja es solo para el Administrador Global y la Oficina Nacional.
      </Alert>
    );
  }

  return (
    <>
    {/* La cuenta atrás de la landing: se elige aquí y la página la aplica sola. */}
    <CuentaRegresivaLandingCard user={user} />
    <Card>
      <InterruptorCargaAutomatica user={user} />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ p: 3, pb: 0, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Lo que los directivos registran o corrigen desde la página de actualización. No entra en
          la aplicación hasta que se revisa aquí.
        </Typography>

        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Iconify icon="solar:download-bold" />}
          onClick={handleDescargar}
          disabled={!filas?.length || descargando}
          sx={{ flexShrink: 0 }}
        >
          {descargando ? 'Generando…' : 'Descargar Excel'}
        </Button>
      </Stack>

      {seleccion.length > 0 && (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{
            mx: 3,
            mt: 2,
            p: 1.5,
            borderRadius: 1,
            alignItems: 'center',
            bgcolor: 'primary.lighter',
          }}
        >
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {seleccion.length} seleccionada{seleccion.length === 1 ? '' : 's'}
          </Typography>
          {/* Descartar algo ya cargado no deshace la carga: solo con pendientes. */}
          <Button color="inherit" onClick={handleDescartar} disabled={trabajando || hayRecargas}>
            Descartar
          </Button>
          <Button
            variant="outlined"
            startIcon={<Iconify icon="solar:list-bold" />}
            onClick={() => setPorCampos(true)}
            disabled={trabajando}
          >
            Cargar por campos
          </Button>
          <Button
            variant="contained"
            startIcon={
              <Iconify icon={hayRecargas ? 'solar:restart-bold' : 'solar:check-circle-bold'} />
            }
            onClick={handleCargar}
            loading={trabajando}
          >
            {hayRecargas ? 'Volver a cargar' : 'Cargar en la aplicación'}
          </Button>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ m: 3, mb: 0 }}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ mt: 2 }}>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  disabled={!pendientes.length || trabajando}
                  checked={!!pendientes.length && seleccion.length === pendientes.length}
                  indeterminate={seleccion.length > 0 && seleccion.length < pendientes.length}
                  onChange={alternarTodas}
                  inputProps={{ 'aria-label': 'Elegir todas (pendientes y cargadas)' }}
                />
              </TableCell>
              <TableCell>Recibida</TableCell>
              <TableCell>Destacamento</TableCell>
              <TableCell>Sección</TableCell>
              <TableCell>Región</TableCell>
              <TableCell>Enviada por</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>

          <TableBody>
            {filas === null &&
              [0, 1, 2].map((i) => (
                <TableRow key={i}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <TableCell key={j}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {filas?.map((fila) => (
              <TableRow key={fila.id} hover selected={elegidas.includes(fila.id)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    disabled={!marcables.includes(fila) || trabajando}
                    checked={elegidas.includes(fila.id) && marcables.includes(fila)}
                    onChange={() => alternar(fila.id)}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {fechaCorta(fila.fechaEnvio)}
                  {/* El mismo destacamento mandó el formulario más de una vez. */}
                  {repetidos[fila.id] > 0 && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'warning.main', fontWeight: 600 }}>
                      {textoRepetido(repetidos[fila.id])}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <EnlaceAFicha
                    href={idDestacamentoDe(fila) && paths.dashboard.level.dest.edit(idDestacamentoDe(fila))}
                  >
                    {destacamentoDe(fila)}
                  </EnlaceAFicha>
                  {/* Quién dio de alta la carga: el coordinador, quien envía o los dos. */}
                  {textoPersonasCreadas(fila.personasCreadas) && (
                    <Label color="info" variant="soft" sx={{ display: 'flex', width: 'fit-content', mt: 0.5 }}>
                      {textoPersonasCreadas(fila.personasCreadas)}
                    </Label>
                  )}
                  {/* Lo que dijo quien lo envió: el padrón no guarda este dato. */}
                  {fila.datos?.cantidadMiembros != null && fila.datos.cantidadMiembros !== '' && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {fila.datos.cantidadMiembros} miembros aprox.
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{fila.seccion?.nombre || fila.nombreSeccion || '—'}</TableCell>
                <TableCell>{fila.region?.nombre || fila.nombreRegion || '—'}</TableCell>
                <TableCell>
                  <EnlaceAFicha
                    href={idEnviadorDe(fila) && paths.dashboard.level.member.edit(idEnviadorDe(fila))}
                  >
                    {fila.enviadoPor?.nombre || fila.nombreRemitente || '—'}
                  </EnlaceAFicha>
                  {fila.enviadoPor?.codigoMiembro && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {fila.enviadoPor.codigoMiembro}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Label color={COLOR_ESTADO[fila.estado] || 'default'}>
                    {TEXTO_ESTADO[fila.estado] || fila.estado}
                  </Label>
                </TableCell>
                <TableCell padding="checkbox">
                  <IconButton aria-label="Ver cambios" onClick={() => setAbierta(fila)}>
                    <Iconify icon="solar:eye-bold" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Elegir qué datos del envío se aplican, con vista previa. */}
      <CargaPorCamposDialog
        open={porCampos}
        onClose={() => setPorCampos(false)}
        filas={seleccion}
        user={user}
        onTerminado={(resultado) => {
          avisarResultado(resultado);
          setElegidas([]);
        }}
      />

      {/* Ventana flotante con el detalle del envío elegido con el ojo. */}
      <Dialog fullWidth maxWidth="md" open={!!abierta} onClose={() => setAbierta(null)}>
        <DialogTitle>{abierta ? destacamentoDe(abierta) : ''}</DialogTitle>
        <DialogContent dividers>
          {/* Un envío de destacamento nuevo sin cargar: decidir si es uno que ya
              existe o si se crea. Antes solo se podía saltar. */}
          {abierta?.esNuevo && abierta.estado !== ESTADOS_ACTUALIZACION.descartada && (
            <ResolverDestacamentoNuevo
              fila={abierta}
              user={user}
              onTerminado={(resultado) => {
                avisarResultado(resultado);
                setAbierta(null);
              }}
            />
          )}
          {abierta && (
            <Box sx={{ mt: abierta.esNuevo ? 2 : 0 }}>
              <DetalleEnvio fila={abierta} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={() => setAbierta(null)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {filas?.length === 0 && !error && (
        <EmptyContent
          title="Aún no hay actualizaciones"
          description="Cuando un directivo registre o actualice un destacamento desde la página de actualización, aparecerá aquí para revisarlo."
          sx={{ py: 8 }}
        />
      )}
    </Card>
    </>
  );
}

// ----------------------------------------------------------------------
// "Cargar automáticamente": con él encendido, lo que llegue DESDE AHORA se carga
// solo y se avisa (ver src/utils/carga-automatica-actualizaciones.mjs). Lo que
// ya espera en la bandeja sigue siendo manual.

function InterruptorCargaAutomatica({ user }) {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => escucharCargaAutomatica(setConfig), []);

  const cambiar = async (_, activa) => {
    setGuardando(true);
    try {
      await cambiarCargaAutomatica(activa, user);
      toast.success(
        activa
          ? 'Carga automática encendida: lo que llegue desde ahora se cargará solo.'
          : 'Carga automática apagada: lo nuevo esperará a que se cargue a mano.'
      );
    } catch (error) {
      toast.error(error?.message || 'No se pudo cambiar la carga automática.');
    } finally {
      setGuardando(false);
    }
  };

  const activa = Boolean(config?.activa);
  const desde = activa && config?.desde ? new Date(config.desde).toLocaleString('es-DO') : '';

  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        gap: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: (theme) => `dashed 1px ${theme.vars.palette.divider}`,
      }}
    >
      <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
        <Typography variant="subtitle2">Cargar automáticamente</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {activa
            ? `Encendida desde ${desde}${config?.activadaPor?.nombre ? ` por ${config.activadaPor.nombre}` : ''}. Lo que llegue se carga solo y se avisa. Los destacamentos nuevos siguen siendo manuales.`
            : 'Apagada: cada envío espera aquí a que alguien lo cargue.'}
        </Typography>
      </Box>
      <FormControlLabel
        label={activa ? 'Encendida' : 'Apagada'}
        disabled={config === null || guardando}
        control={<Switch checked={activa} onChange={cambiar} />}
        sx={{ m: 0 }}
      />
    </Box>
  );
}
