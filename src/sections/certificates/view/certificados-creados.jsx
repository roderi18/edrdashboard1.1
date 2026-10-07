import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CircularProgress from '@mui/material/CircularProgress';

import {
  hayFiltrosCreados,
  FILTROS_CREADOS_VACIOS,
  opcionesDeFiltroCreados,
  unirCertificadosCreados,
  filtrarCertificadosCreados,
} from 'src/utils/certificados-creados.mjs';

import { leerCodigoDeUsuario } from 'src/services/codigo-de-usuario-service';
import { listarEmitidosOnerrd } from 'src/services/certificado-onerrd-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { FilasDeListaCargando } from 'src/components/pantalla-cargando';

import { useAuthContext } from 'src/auth/hooks';

import { puedeUsarOnerrd } from '../onerrd/puede-usar-onerrd';
import {
  tieneFacturaOnerrd,
  descargarFacturaOnerrd,
  tienePdfGuardadoOnerrd,
  descargarCertificadoOnerrdGuardado,
} from '../onerrd/descargas-onerrd';

// ----------------------------------------------------------------------
// PESTAÑA "CERTIFICADOS CREADOS": los lotes de "Crear certificados" y los
// certificados ONERRD en una sola lista, con filtros (lote, certificado,
// fecha, creado por) y el código de quien lo creó debajo de su nombre.
//
// Los ONERRD solo los ve quien gestiona el ONERRD (Administrador Global y
// Oficina Nacional). Su "Ver lista" descarga el certificado guardado o su
// factura; el de los lotes sigue siendo el de la pantalla (`onVerLote`).
// Reglas de la lista en `src/utils/certificados-creados.mjs`.
// ----------------------------------------------------------------------

const COLUMNAS = 7;

function CreadoPor({ creador, codigos }) {
  const codigo = creador.codigo || (creador.uid && codigos[creador.uid]) || '';
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">{creador.nombre}</Typography>
      {/* "Sistema" no es una persona: su `codigo` llega vacío. */}
      {!!codigo && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {codigo}
        </Typography>
      )}
    </Stack>
  );
}

function DialogoOnerrd({ fila, onCerrar }) {
  const [menu, setMenu] = useState(null);
  const [descargando, setDescargando] = useState('');
  const emitido = fila?.origen;
  if (!emitido) return null;
  const valores = emitido.valores || {};

  const descargar = async (tipo) => {
    setMenu(null);
    setDescargando(tipo);
    try {
      if (tipo === 'factura') await descargarFacturaOnerrd(emitido);
      else await descargarCertificadoOnerrdGuardado(emitido);
    } catch (error) {
      toast.error(error?.message || 'No se pudo descargar.');
    } finally {
      setDescargando('');
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open onClose={onCerrar}>
      <DialogTitle>
        <Stack spacing={0.5}>
          <Typography variant="h6">{fila.id}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {fila.titulo} · {dayjs(fila.creadoEn).format('DD/MM/YYYY hh:mm A')}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Destacamento</TableCell>
                <TableCell>Iglesia</TableCell>
                <TableCell>Factura</TableCell>
                <TableCell align="right">Descarga</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>{fila.detalle || '-'}</TableCell>
                <TableCell>{valores.iglesia || '-'}</TableCell>
                <TableCell>
                  {emitido.factura?.numero ? `N.º ${emitido.factura.numero}` : '-'}
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!!descargando}
                    onClick={(event) => setMenu(event.currentTarget)}
                    startIcon={
                      descargando ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <Iconify icon="solar:download-bold" />
                      )
                    }
                    endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} />}
                  >
                    {descargando ? 'Preparando...' : 'Descargar'}
                  </Button>
                  <Menu
                    anchorEl={menu}
                    open={!!menu}
                    onClose={() => setMenu(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <MenuItem
                      disabled={!tienePdfGuardadoOnerrd(emitido)}
                      onClick={() => descargar('certificado')}
                    >
                      <ListItemIcon>
                        <Iconify icon="solar:medal-ribbon-star-bold" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Descargar certificado"
                        secondary={tienePdfGuardadoOnerrd(emitido) ? undefined : 'Sin PDF guardado'}
                      />
                    </MenuItem>
                    <MenuItem
                      disabled={!tieneFacturaOnerrd(emitido)}
                      onClick={() => descargar('factura')}
                    >
                      <ListItemIcon>
                        <Iconify icon="solar:file-text-bold" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Descargar factura"
                        secondary={
                          tieneFacturaOnerrd(emitido)
                            ? undefined
                            : 'Emitido antes de que existiera la factura'
                        }
                      />
                    </MenuItem>
                  </Menu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CertificadosCreados({ lotes, cargandoLotes, onVerLote }) {
  const { user } = useAuthContext();
  const conOnerrd = puedeUsarOnerrd(user);

  const [emitidos, setEmitidos] = useState([]);
  const [cargandoOnerrd, setCargandoOnerrd] = useState(conOnerrd);
  const [filtros, setFiltros] = useState(FILTROS_CREADOS_VACIOS);
  const [codigos, setCodigos] = useState({});
  const [onerrdAbierto, setOnerrdAbierto] = useState(null);

  useEffect(() => {
    if (!conOnerrd) return undefined;
    let vivo = true;
    listarEmitidosOnerrd()
      .then((lista) => vivo && setEmitidos(lista))
      .catch((error) => console.error('[certificados] no se pudieron leer los ONERRD', error))
      .finally(() => vivo && setCargandoOnerrd(false));
    return () => {
      vivo = false;
    };
  }, [conOnerrd]);

  const filas = useMemo(() => unirCertificadosCreados(lotes, emitidos), [lotes, emitidos]);
  const opciones = useMemo(() => opcionesDeFiltroCreados(filas), [filas]);
  const visibles = useMemo(() => filtrarCertificadosCreados(filas, filtros), [filas, filtros]);

  // El código de quien creó los registros viejos (solo guardaban uid y nombre).
  useEffect(() => {
    const faltan = [
      ...new Set(
        filas
          .filter((fila) => !fila.creador.codigo && fila.creador.uid)
          .map((fila) => fila.creador.uid)
          .filter((uid) => !(uid in codigos))
      ),
    ];
    if (!faltan.length) return undefined;
    let vivo = true;
    Promise.all(faltan.map(async (uid) => [uid, await leerCodigoDeUsuario(uid)])).then(
      (pares) => vivo && setCodigos((actual) => ({ ...actual, ...Object.fromEntries(pares) }))
    );
    return () => {
      vivo = false;
    };
  }, [filas, codigos]);

  const cambiar = (clave) => (valor) => setFiltros((actual) => ({ ...actual, [clave]: valor }));
  const cargando = cargandoLotes || cargandoOnerrd;

  return (
    <Card>
      <Stack spacing={2} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h6">Certificados creados</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Historial de lotes guardados en Firebase.
            </Typography>
          </Box>

          <Chip
            color="primary"
            variant="soft"
            label={
              cargando
                ? 'Cargando…'
                : hayFiltrosCreados(filtros)
                  ? `${visibles.length} de ${filas.length}`
                  : `${filas.length} lote${filas.length === 1 ? '' : 's'}`
            }
          />
        </Stack>

        {/* Filtros: lote, certificado, fecha (desde/hasta) y creado por. */}
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            alignItems: 'center',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'minmax(0, 1.2fr) minmax(0, 1fr) 150px 150px minmax(0, 1fr) auto',
            },
          }}
        >
          <TextField
            size="small"
            label="Lote"
            placeholder="CERT-2026… o 2027-009"
            value={filtros.lote}
            onChange={(event) => cambiar('lote')(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Certificado"
            value={filtros.certificado}
            onChange={(event) => cambiar('certificado')(event.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            {opciones.certificados.map((titulo) => (
              <MenuItem key={titulo} value={titulo}>
                {titulo}
              </MenuItem>
            ))}
          </TextField>
          <DatePicker
            label="Desde"
            format="DD/MM/YYYY"
            value={filtros.desde ? dayjs(filtros.desde) : null}
            onChange={(fecha) =>
              cambiar('desde')(fecha?.isValid() ? fecha.format('YYYY-MM-DD') : '')
            }
            slotProps={{ textField: { size: 'small' }, field: { clearable: true } }}
          />
          <DatePicker
            label="Hasta"
            format="DD/MM/YYYY"
            value={filtros.hasta ? dayjs(filtros.hasta) : null}
            onChange={(fecha) =>
              cambiar('hasta')(fecha?.isValid() ? fecha.format('YYYY-MM-DD') : '')
            }
            slotProps={{ textField: { size: 'small' }, field: { clearable: true } }}
          />
          <TextField
            select
            size="small"
            label="Creado por"
            value={filtros.creadoPor}
            onChange={(event) => cambiar('creadoPor')(event.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            {opciones.creadores.map((nombre) => (
              <MenuItem key={nombre} value={nombre}>
                {nombre}
              </MenuItem>
            ))}
          </TextField>
          <Button
            color="inherit"
            disabled={!hayFiltrosCreados(filtros)}
            onClick={() => setFiltros(FILTROS_CREADOS_VACIOS)}
            startIcon={<Iconify icon="solar:restart-bold" />}
          >
            Limpiar
          </Button>
        </Box>
      </Stack>

      <TableContainer>
        <Scrollbar>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Lote</TableCell>
                <TableCell>Certificado</TableCell>
                <TableCell>Cantidad</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Creado por</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {visibles.map((fila) => (
                <TableRow key={`${fila.tipo}-${fila.id}`} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{fila.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{fila.titulo}</Typography>
                      {!!fila.detalle && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {fila.detalle}
                        </Typography>
                      )}
                      {!!fila.plantilla && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Plantilla: {fila.plantilla}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>{fila.cantidad}</TableCell>
                  <TableCell>{dayjs(fila.creadoEn).format('DD/MM/YYYY')}</TableCell>
                  <TableCell>{dayjs(fila.creadoEn).format('hh:mm A')}</TableCell>
                  <TableCell>
                    <CreadoPor creador={fila.creador} codigos={codigos} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Iconify icon="solar:list-bold" />}
                      onClick={() =>
                        fila.tipo === 'onerrd' ? setOnerrdAbierto(fila) : onVerLote(fila.origen)
                      }
                    >
                      Ver lista
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {cargando && (
                <TableRow>
                  <TableCell colSpan={COLUMNAS} sx={{ p: 0 }}>
                    <FilasDeListaCargando filas={5} />
                  </TableCell>
                </TableRow>
              )}

              {!cargando && !visibles.length && (
                <TableRow>
                  <TableCell colSpan={COLUMNAS}>
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                      <Typography variant="subtitle1">
                        {filas.length
                          ? 'Ningún certificado con esos filtros'
                          : 'Todavía no hay certificados creados'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        {filas.length
                          ? 'Cambia o limpia los filtros para ver más.'
                          : 'Cuando descargues un lote, aparecerá aquí con su detalle.'}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      {onerrdAbierto && (
        <DialogoOnerrd fila={onerrdAbierto} onCerrar={() => setOnerrdAbierto(null)} />
      )}
    </Card>
  );
}
