'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { puedeAprobarCambiosDeOrganizacion } from 'src/utils/org-level-access';

import { DashboardContent } from 'src/layouts/dashboard';
import { obtenerSolicitudesCambio } from 'src/services/solicitudes-cambio-service';
import { aprobarSolicitud, rechazarSolicitud } from 'src/services/aplicar-solicitud-service';

import { toast } from 'src/components/snackbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const ETIQUETA_AMBITO = {
  destacamento: 'Destacamento',
  seccion: 'Sección',
  region: 'Región',
  directiva_seccion: 'Directiva de sección',
  directiva_region: 'Directiva de región',
  directiva_nacional: 'Directiva del Consejo Nacional',
};

const mostrarValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';

  return String(valor);
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

  const puedeResolver = puedeAprobarCambiosDeOrganizacion(user);

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      setSolicitudes(await obtenerSolicitudesCambio({ estado: 'pendiente' }));
    } catch (error) {
      console.error('[aprobaciones] no se pudieron cargar las solicitudes', error);
      toast.error('No se pudieron cargar las solicitudes pendientes.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && puedeResolver) {
      cargar();
    } else if (!loading) {
      setCargando(false);
    }
  }, [loading, puedeResolver, cargar]);

  const resolver = async (solicitud, accion, comentarioTexto = '') => {
    setEnCurso(solicitud.id);

    try {
      if (accion === 'aprobar') {
        await aprobarSolicitud(solicitud, { usuario: user, comentario: comentarioTexto });
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
    }
  };

  if (loading || cargando) {
    return (
      <DashboardContent>
        <Stack sx={{ alignItems: 'center', py: 8 }}>
          <CircularProgress />
        </Stack>
      </DashboardContent>
    );
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
                  <Button
                    color="primary"
                    variant="contained"
                    disabled={Boolean(enCurso)}
                    onClick={() => resolver(solicitud, 'aprobar')}
                  >
                    {enCurso === solicitud.id ? 'Aplicando...' : 'Aprobar'}
                  </Button>
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
