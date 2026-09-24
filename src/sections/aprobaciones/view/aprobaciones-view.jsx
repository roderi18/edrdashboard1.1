'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { paths } from 'src/routes/paths';

import { puedeAprobarCambiosDeOrganizacion } from 'src/utils/org-level-access';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import { aprobarSolicitud, rechazarSolicitud } from 'src/services/aplicar-solicitud-service';
import {
  esSuPropiaSolicitud,
  obtenerSolicitudesCambio,
} from 'src/services/solicitudes-cambio-service';

import { toast } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { PantallaDeListaCargando } from 'src/components/pantalla-cargando';

// El MISMO dialogo con el que el Coordinador de Destacamento revisa los cambios
// de un miembro: se rechaza campo a campo y se aprueba lo que queda. Aqui vale
// igual —una propuesta de destacamento tambien puede traer cuatro cambios y solo
// dos buenos— y repetirlo seria mantener dos veces la misma pantalla.
import { MemberChangeRequestDialog } from 'src/sections/member/member-change-request-dialog';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const ETIQUETA_AMBITO = {
  destacamento: 'Destacamento',
  foto_destacamento: 'Foto de destacamento',
  foto_seccion: 'Foto de sección',
  foto_region: 'Foto de región',
  pastor_destacamento: 'Pastor del destacamento',
  seccion: 'Sección',
  region: 'Región',
  directiva_seccion: 'Directiva de sección',
  directiva_region: 'Directiva de región',
  directiva_nacional: 'Directiva del Consejo Nacional',
};

const esUrlDeImagen = (valor) => /^https?:\/\//i.test(String(valor || ''));

// Una foto se juzga mirandola. Pintar la url en la tabla obligaba a copiarla y
// abrirla en otra pestaña para saber que se estaba aprobando.
const mostrarValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';

  if (esUrlDeImagen(valor)) {
    return (
      <Box
        component="img"
        loading="lazy"
        decoding="async"
        src={String(valor)}
        alt=""
        sx={{
          width: 72,
          height: 72,
          borderRadius: 1,
          objectFit: 'cover',
          border: (theme) => `solid 1px ${theme.vars.palette.divider}`,
        }}
      />
    );
  }

  return String(valor);
};

// Una propuesta de directiva nombra a una persona, y quien aprueba tiene que
// saber a quien: con nombre y, debajo, su codigo (dos miembros pueden llamarse
// igual). Las guardadas cuando quien llamaba solo traia el id decian "el miembro
// 323". Se resuelve al pintar, sin reescribir la solicitud.
const MIEMBRO_SIN_NOMBRE = /^el miembro (\d+)$/i;

const nombreDelMiembro = (miembro) =>
  [miembro?.firstName ?? miembro?.nombres, miembro?.lastName ?? miembro?.apellidos]
    .filter(Boolean)
    .join(' ')
    .trim();

const esDeDirectiva = (solicitud) =>
  solicitud?.entidad?.tipo === 'asignacion_directiva' && Boolean(solicitud?.payload?.idMiembro);

const conMiembrosResueltos = async (solicitudes) => {
  if (!solicitudes.some(esDeDirectiva)) return solicitudes;

  let porId = new Map();

  try {
    const miembros = await getMembers();
    porId = new Map(
      (Array.isArray(miembros) ? miembros : []).flatMap((miembro) => [
        [String(miembro.idMiembros ?? ''), miembro],
        [String(miembro.id ?? ''), miembro],
      ])
    );
  } catch {
    // Sin listado se pinta lo que traiga la solicitud: mejor eso que no poder aprobar.
  }

  return solicitudes.map((solicitud) => {
    if (!esDeDirectiva(solicitud)) return solicitud;

    const { idMiembro, nombreMiembro, codigoMiembro } = solicitud.payload;
    const miembro = porId.get(String(idMiembro));
    const nombre = nombreDelMiembro(miembro) || String(nombreMiembro || '').trim();
    const codigo = String(
      miembro?.memberId || miembro?.codigoMiembro || codigoMiembro || ''
    ).trim();

    return {
      ...solicitud,
      cambios: (solicitud.cambios || []).map((cambio) => {
        const texto = String(cambio.despues ?? '');
        const esLaPersona = MIEMBRO_SIN_NOMBRE.test(texto) || (nombre && texto === nombre);

        return esLaPersona
          ? { ...cambio, despues: nombre || cambio.despues, codigoDespues: codigo }
          : cambio;
      }),
    };
  });
};

const formatearFecha = (valor) => {
  if (!valor) return '';

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? '' : fecha.toLocaleString('es-DO');
};

export function AprobacionesView() {
  const { user, loading } = useAuthContext();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [enCurso, setEnCurso] = useState('');
  const [rechazo, setRechazo] = useState(null);
  const [comentario, setComentario] = useState('');
  // Propuesta abierta para elegir QUE se aprueba (solo si trae mas de un cambio).
  const [seleccion, setSeleccion] = useState(null);
  // Lo elegido, a la espera del "si, apruebalo".
  const [confirmacion, setConfirmacion] = useState(null);

  const puedeResolver = puedeAprobarCambiosDeOrganizacion(user);

  // Otra sesión propuso o resolvió algo: la bandeja se relee sola. El esqueleto
  // sale solo la primera vez; después se actualiza sin tapar lo que se ve.
  const cambiosVivos = useLecturasVivas(['solicitudes:']);
  const yaCargadoRef = useRef(false);

  const cargar = useCallback(async () => {
    if (!yaCargadoRef.current) setCargando(true);

    try {
      setSolicitudes(
        await conMiembrosResueltos(await obtenerSolicitudesCambio({ estado: 'pendiente' }))
      );
    } catch (error) {
      console.error('[aprobaciones] no se pudieron cargar las solicitudes', error);
      toast.error('No se pudieron cargar las solicitudes pendientes.');
    } finally {
      yaCargadoRef.current = true;
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && puedeResolver) {
      cargar();
    } else if (!loading) {
      setCargando(false);
    }
  }, [loading, puedeResolver, cargar, cambiosVivos]);

  const resolver = async (solicitud, accion, comentarioTexto = '', payload = null) => {
    setEnCurso(solicitud.id);

    try {
      if (accion === 'aprobar') {
        await aprobarSolicitud(solicitud, { usuario: user, comentario: comentarioTexto, payload });
        toast.success('Cambio aprobado y aplicado.');
      } else {
        await rechazarSolicitud(solicitud, { usuario: user, comentario: comentarioTexto });
        toast.info('Cambio rechazado.');
      }

      await cargar();
    } catch (error) {
      console.error('[aprobaciones] no se pudo resolver la solicitud', error);
      // El motivo real importa: puede ser que el backend rechazara la escritura.
      toast.error(error?.message || 'No se pudo resolver la solicitud.');
    } finally {
      setEnCurso('');
      setRechazo(null);
      setComentario('');
      setSeleccion(null);
      setConfirmacion(null);
    }
  };

  // Un solo cambio no hay nada que elegir: se pregunta y se aplica. Con varios se
  // abre el dialogo de revision campo a campo.
  const pedirAprobar = (solicitud) => {
    if ((solicitud?.cambios?.length || 0) > 1) {
      setSeleccion(solicitud);
      return;
    }

    setConfirmacion({
      solicitud,
      payload: null,
      aprobados: solicitud?.cambios?.length || 0,
      total: solicitud?.cambios?.length || 0,
    });
  };

  // Lo que devuelve el dialogo: por campo, si se aprueba y con que valor. Los
  // rechazados vuelven a su valor anterior, asi que lo que se escribe es la
  // mezcla, no lo propuesto.
  const revisarSeleccion = (decision = []) => {
    const solicitud = seleccion;

    if (!solicitud) return;

    const aprobados = decision.filter((campo) => campo.aprobado);

    if (!aprobados.length) {
      // Rechazarlo todo es rechazar la propuesta: se pide el motivo, como
      // siempre, en vez de aplicar un cambio vacio.
      setSeleccion(null);
      setRechazo(solicitud);
      return;
    }

    const payload = decision.reduce(
      (acumulado, campo) => ({
        ...acumulado,
        [campo.campo]: campo.aprobado ? campo.valorFinal : campo.antes,
      }),
      { ...(solicitud.payload || {}) }
    );

    setSeleccion(null);
    setConfirmacion({ solicitud, payload, aprobados: aprobados.length, total: decision.length });
  };

  if (loading || cargando) {
    // La pantalla en esqueleto, no un spinner en medio.
    return <PantallaDeListaCargando />;
  }

  if (!puedeResolver) {
    return (
      <DashboardContent>
        <CustomBreadcrumbs
          heading="Aprobaciones"
          links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Aprobaciones' }]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />
        <Alert severity="warning">
          Solo la Oficina Nacional y el Administrador Global pueden resolver estos cambios.
        </Alert>
      </DashboardContent>
    );
  }

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Aprobaciones"
        links={[{ name: 'Panel', href: paths.dashboard.root }, { name: 'Aprobaciones' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!solicitudes.length ? (
        <Alert severity="info">No hay cambios pendientes de aprobación.</Alert>
      ) : (
        <Stack spacing={3}>
          {solicitudes.map((solicitud) => (
            <Card key={solicitud.id} sx={{ p: 3 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
              >
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                    <Chip
                      size="small"
                      color="warning"
                      variant="soft"
                      label={ETIQUETA_AMBITO[solicitud.ambito] || solicitud.ambito}
                    />
                    {solicitud.esSugerencia && (
                      <Chip size="small" variant="outlined" label="Sugerencia" />
                    )}
                    {solicitud.requiereAdministradorGlobal && (
                      <Chip
                        size="small"
                        color="error"
                        variant="soft"
                        label="Revisión del Administrador Global"
                      />
                    )}
                  </Stack>

                  <Typography variant="subtitle1">{solicitud.entidad?.nombre || '—'}</Typography>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Propuesto por {solicitud.solicitadoPorNombre || 'desconocido'}
                    {solicitud.creadoEn ? ` · ${formatearFecha(solicitud.creadoEn)}` : ''}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    color="error"
                    variant="outlined"
                    disabled={Boolean(enCurso)}
                    onClick={() => setRechazo(solicitud)}
                  >
                    Rechazar
                  </Button>
                  {/* Lo suyo no se lo firma: se puede retirar, no aprobar. El
                      boton se explica en vez de desaparecer, para que se
                      entienda que falta OTRA persona y no que algo se rompio. */}
                  <Tooltip
                    arrow
                    placement="top"
                    title={
                      esSuPropiaSolicitud(solicitud, user)
                        ? 'Lo enviaste tú: tiene que revisarlo otra persona de la Oficina Nacional o el Administrador Global.'
                        : ''
                    }
                  >
                    <span>
                      <Button
                        color="primary"
                        variant="contained"
                        disabled={Boolean(enCurso) || esSuPropiaSolicitud(solicitud, user)}
                        onClick={() => pedirAprobar(solicitud)}
                      >
                        {enCurso === solicitud.id
                          ? 'Aplicando...'
                          : esSuPropiaSolicitud(solicitud, user)
                            ? 'Enviado por ti'
                            : (solicitud.cambios?.length || 0) > 1
                              ? 'Revisar y aprobar'
                              : 'Aprobar'}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>

              {solicitud.cambios?.length ? (
                <Box sx={{ mt: 2, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Campo</TableCell>
                        <TableCell>Antes</TableCell>
                        <TableCell>Después</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {solicitud.cambios.map((cambio) => (
                        <TableRow key={cambio.campo}>
                          <TableCell>{cambio.etiqueta || cambio.campo}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {mostrarValor(cambio.antes)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 'fontWeightMedium' }}>
                            {mostrarValor(cambio.despues)}
                            {cambio.codigoDespues && (
                              <Typography
                                variant="caption"
                                component="div"
                                sx={{ color: 'text.secondary', fontWeight: 'fontWeightRegular' }}
                              >
                                {cambio.codigoDespues}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                  La propuesta no detalla campos concretos.
                </Typography>
              )}
            </Card>
          ))}
        </Stack>
      )}

      {/* Varios cambios en la misma propuesta: se revisan uno a uno y se aprueba
          lo que valga. Mismo dialogo que usa el destacamento con sus miembros. */}
      <MemberChangeRequestDialog
        open={Boolean(seleccion)}
        solicitud={
          seleccion
            ? {
                ...seleccion,
                // El dialogo habla en su propio vocabulario: `label` y los textos
                // ya formateados de cada campo.
                cambios: (seleccion.cambios || []).map((cambio) => ({
                  ...cambio,
                  label: cambio.etiqueta || cambio.campo,
                  antesTexto:
                    cambio.antes === null || cambio.antes === undefined ? '' : String(cambio.antes),
                  despuesTexto:
                    cambio.despues === null || cambio.despues === undefined
                      ? ''
                      : String(cambio.despues),
                })),
              }
            : null
        }
        titulo={seleccion?.entidad?.nombre || ''}
        codigo={ETIQUETA_AMBITO[seleccion?.ambito] || seleccion?.ambito || ''}
        saving={Boolean(enCurso)}
        onClose={() => setSeleccion(null)}
        onResolve={revisarSeleccion}
      />

      {/* Aplicar un cambio ajeno no se hace de un clic despistado. */}
      <ConfirmDialog
        open={Boolean(confirmacion)}
        onClose={() => setConfirmacion(null)}
        title="Aprobar el cambio"
        content={
          confirmacion ? (
            <>
              Se aplicará
              {confirmacion.aprobados === confirmacion.total
                ? ' lo propuesto'
                : ` ${confirmacion.aprobados} de ${confirmacion.total} cambios`}{' '}
              en <strong>{confirmacion.solicitud?.entidad?.nombre || 'la organización'}</strong>.
              ¿Confirmas?
            </>
          ) : null
        }
        action={
          <Button
            variant="contained"
            disabled={Boolean(enCurso)}
            onClick={() => resolver(confirmacion.solicitud, 'aprobar', '', confirmacion.payload)}
          >
            Sí, aprobar
          </Button>
        }
      />

      {/* El rechazo pide un motivo: quien propuso el cambio merece saber por que
          no salio adelante, y el motivo queda en Historial con la resolucion. */}
      <Dialog open={Boolean(rechazo)} onClose={() => setRechazo(null)} fullWidth maxWidth="sm">
        <DialogTitle>Rechazar el cambio</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            autoFocus
            label="Motivo o sugerencia"
            placeholder="Explica por qué no se aprueba, o qué habría que corregir."
            value={comentario}
            onChange={(event) => setComentario(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRechazo(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!comentario.trim()}
            onClick={() => resolver(rechazo, 'rechazar', comentario.trim())}
          >
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}
