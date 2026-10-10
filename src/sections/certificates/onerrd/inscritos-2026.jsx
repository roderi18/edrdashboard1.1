import dayjs from 'dayjs';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableSortLabel from '@mui/material/TableSortLabel';
import TableContainer from '@mui/material/TableContainer';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { sanearInscrito, normalizarNumeroDestacamento } from 'src/utils/membresia-onerrd.mjs';
import {
  fechaReporteRegistro,
  LEYENDA_REPORTE_REGISTRO,
} from 'src/utils/reporte-registro-membresia.mjs';

import {
  leerPagosMembresia,
  guardarInscritos2026,
  leerConfiguracionMembresia,
} from 'src/services/membresia-onerrd-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { TituloDesplegable } from './factura-editor';

// ----------------------------------------------------------------------
// «INSCRIPCIÓN DESTACAMENTOS ANTERIORES» (desplegable debajo de «Membresías
// 2027 · pagos»): la lista de destacamentos inscritos en
// 2026, igual que el reporte de registro anual de 2026 (registro, número del
// destacamento con su * o **, fecha, región y quién lo registró, con la leyenda
// y la firma). A esos destacamentos la landing les ofrece el plan «Registrado en
// 2026», con el descuento por fidelidad.
//
// Cada fila va anclada al NÚMERO del destacamento en la API .NET: al lado sale
// el nombre que tiene allí, o un aviso si ese número no existe, para que un
// error de tecleo no deje a un destacamento sin su descuento.
// ----------------------------------------------------------------------

const REGIONES = ['Central', 'Norte', 'Sur', 'Este'];

// "2025-11-07" a mediodía de Santo Domingo: a medianoche UTC salía el día antes.
const fechaDeFila = (fecha) => (fecha ? `${fecha}T12:00:00-04:00` : '');

// Siempre ordenada, por defecto, por número de destacamento de menor a mayor; las
// flechas de cada columna cambian el criterio y el sentido.
const COLUMNAS = [
  { id: 'registro', texto: 'Registro No.' },
  { id: 'numero', texto: 'Dest. No.' },
  { id: 'fecha', texto: 'Fecha reg.' },
  { id: 'region', texto: 'Región' },
  { id: 'registradoPor', texto: 'Registrado por' },
  { id: 'enApi', texto: 'En la API' },
];

const comparar = (a, b, campo, nombreApi) => {
  if (campo === 'numero') return Number(a.numero || 0) - Number(b.numero || 0);
  const va = campo === 'enApi' ? nombreApi(a) : a[campo] || '';
  const vb = campo === 'enApi' ? nombreApi(b) : b[campo] || '';
  return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
};

const porNumeroAsc = (lista) =>
  [...(lista || [])].sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

const filaVacia = () => ({
  registro: '',
  numero: '',
  marca: '',
  fecha: '',
  region: '',
  registradoPor: '',
});

export function Inscritos2026({ abierto, onAlternar, user }) {
  const [filas, setFilas] = useState(null);
  // El padrón de la API (número → destacamento): el mismo que lee la tabla de
  // pagos, de la caché de lecturas.
  const [padron, setPadron] = useState([]);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState('');
  const [orden, setOrden] = useState({ campo: 'numero', sentido: 'asc' });

  useEffect(() => {
    if (!abierto) return;
    setEditando(false);
    setError('');
    leerConfiguracionMembresia()
      .then((c) => setFilas(porNumeroAsc(c.inscritos2026)))
      .catch(() => setError('No se pudo leer la lista.'));
    leerPagosMembresia()
      .then((d) => setPadron(d.padron || []))
      .catch(() => {});
  }, [abierto]);

  // El destacamento de la API por su número (sin ceros a la izquierda).
  const porNumero = useMemo(
    () => new Map(padron.map((d) => [normalizarNumeroDestacamento(d.numero), d])),
    [padron]
  );

  // Las filas con su posición original (la edición la necesita), ordenadas. Al
  // editar se deja el orden guardado: una fila no salta mientras se teclea.
  const filasOrdenadas = useMemo(() => {
    const conIndice = (filas || []).map((f, i) => ({ f, i }));
    if (editando) return conIndice;
    const nombreApi = (f) => porNumero.get(normalizarNumeroDestacamento(f.numero))?.nombre || '';
    const signo = orden.sentido === 'asc' ? 1 : -1;
    return conIndice.sort(
      (x, y) =>
        signo * comparar(x.f, y.f, orden.campo, nombreApi) ||
        Number(x.f.numero || 0) - Number(y.f.numero || 0)
    );
  }, [filas, editando, orden, porNumero]);

  const ordenarPor = (campo) =>
    setOrden((o) =>
      o.campo === campo
        ? { campo, sentido: o.sentido === 'asc' ? 'desc' : 'asc' }
        : { campo, sentido: 'asc' }
    );

  const cambiarFila = (indice, campo, valor) =>
    setFilas((actual) => actual.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)));

  const guardar = async () => {
    setGuardando(true);
    try {
      const guardadas = await guardarInscritos2026({
        filas: filas.map(sanearInscrito),
        user,
      });
      setFilas(porNumeroAsc(guardadas));
      setEditando(false);
      toast.success(`Lista guardada: ${guardadas.length} destacamentos.`);
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar la lista.');
    } finally {
      setGuardando(false);
    }
  };

  const descargar = async () => {
    setDescargando(true);
    let url;
    try {
      const { crearReporteRegistroPdf } = await import('./membresia-reporte-pdf');
      const documento = await crearReporteRegistroPdf(
        filasOrdenadas.map(({ f, i }) => ({
          id: `${f.numero}-${i}`,
          registro: f.registro,
          destacamento: `${f.numero}${f.marca}`,
          fecha: fechaDeFila(f.fecha),
          region: f.region,
          registradoPor: f.registradoPor,
        })),
        new Date().toISOString(),
        undefined,
        {
          anio: 2026,
          subtitulo: `Destacamentos inscritos en 2026 · ${filas.length}`,
          nota: '',
        }
      );
      url = URL.createObjectURL(documento);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'ERRD-reporte-registro-anual-destacamentos-2026.pdf';
      enlace.click();
    } catch (e) {
      toast.error(e.message || 'No se pudo generar el PDF.');
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDescargando(false);
    }
  };

  const sinApi = (filas || []).filter(
    (f) => f.numero && !porNumero.has(normalizarNumeroDestacamento(f.numero))
  );

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
        <Iconify icon="solar:users-group-rounded-bold" sx={{ color: 'primary.main' }} />
        <TituloDesplegable
          titulo="Inscripción destacamentos anteriores"
          abierto={abierto}
          onAlternar={onAlternar}
        />
        {filas && <Label color="info">{filas.length} inscritos en 2026</Label>}
      </Stack>
      <Collapse in={abierto} unmountOnExit>
        <Box sx={{ mt: 2.5 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            A los destacamentos de esta lista la landing les ofrece el plan «Registrado en 2026»,
            con el descuento por fidelidad. Cada fila se busca por su número en la API.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {padron.length > 0 && sinApi.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {sinApi.length === 1 ? 'Un número no está' : `${sinApi.length} números no están`} en
              la API: {sinApi.map((f) => f.numero).join(', ')}. Esos destacamentos no recibirán el
              descuento hasta corregirlo.
            </Alert>
          )}
          {/* La hoja, como el reporte de registro anual. Siempre en claro (papel
              blanco): en modo oscuro las letras salían blancas sobre blanco. */}
          <Box
            data-color-scheme="light"
            sx={{
              bgcolor: '#fff',
              color: '#171b27',
              p: { xs: 2, md: 5 },
              minHeight: 480,
              boxShadow: 1,
            }}
          >
            <Typography fontWeight={700} variant="subtitle1">
              Oficina Nacional de Exploradores del Rey, Rep. Dominicana 2026
            </Typography>
            <Typography fontStyle="italic" variant="body2">
              oficinanacional@errd.org.do
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1.5 }}>
              Destacamentos inscritos en 2026 · {filas?.length ?? '…'}
            </Typography>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eef2f8' }}>
                    {COLUMNAS.map(({ id, texto }) => (
                      <TableCell
                        key={id}
                        sortDirection={orden.campo === id ? orden.sentido : false}
                      >
                        <TableSortLabel
                          active={orden.campo === id}
                          direction={orden.campo === id ? orden.sentido : 'asc'}
                          disabled={editando}
                          onClick={() => ordenarPor(id)}
                        >
                          {texto}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    {editando && <TableCell />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filasOrdenadas.map(({ f, i }) => {
                    const enApi = porNumero.get(normalizarNumeroDestacamento(f.numero));
                    return (
                      <TableRow key={i}>
                        {editando ? (
                          <>
                            <TableCell sx={{ width: 110 }}>
                              <TextField
                                size="small"
                                value={f.registro}
                                placeholder="001"
                                onChange={(e) =>
                                  cambiarFila(i, 'registro', e.target.value.toUpperCase())
                                }
                              />
                            </TableCell>
                            <TableCell sx={{ width: 160 }}>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <TextField
                                  size="small"
                                  value={f.numero}
                                  placeholder="43"
                                  onChange={(e) =>
                                    cambiarFila(i, 'numero', e.target.value.replace(/\D/g, ''))
                                  }
                                  sx={{ width: 80 }}
                                />
                                <TextField
                                  select
                                  size="small"
                                  value={f.marca}
                                  onChange={(e) => cambiarFila(i, 'marca', e.target.value)}
                                  sx={{ width: 64 }}
                                >
                                  <MenuItem value="">—</MenuItem>
                                  <MenuItem value="*">*</MenuItem>
                                  <MenuItem value="**">**</MenuItem>
                                </TextField>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ width: 180 }}>
                              <DatePicker
                                format="DD/MM/YYYY"
                                value={f.fecha ? dayjs(f.fecha) : null}
                                onChange={(v) =>
                                  cambiarFila(
                                    i,
                                    'fecha',
                                    v?.isValid() ? v.format('YYYY-MM-DD') : ''
                                  )
                                }
                                slotProps={{ textField: { size: 'small' } }}
                              />
                            </TableCell>
                            <TableCell sx={{ width: 130 }}>
                              <TextField
                                select
                                size="small"
                                fullWidth
                                value={f.region}
                                onChange={(e) => cambiarFila(i, 'region', e.target.value)}
                              >
                                {REGIONES.map((r) => (
                                  <MenuItem key={r} value={r}>
                                    {r}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                value={f.registradoPor}
                                onChange={(e) => cambiarFila(i, 'registradoPor', e.target.value)}
                              />
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{f.registro}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              {f.numero}
                              {f.marca}
                            </TableCell>
                            <TableCell>{fechaReporteRegistro(fechaDeFila(f.fecha))}</TableCell>
                            <TableCell>{f.region}</TableCell>
                            <TableCell>{f.registradoPor}</TableCell>
                          </>
                        )}
                        <TableCell>
                          {!f.numero ? null : enApi ? (
                            <Typography variant="caption">
                              {enApi.nombre || `#${enApi.numero}`}
                            </Typography>
                          ) : padron.length ? (
                            <Label color="error">No está en la API</Label>
                          ) : (
                            <Typography variant="caption">…</Typography>
                          )}
                        </TableCell>
                        {editando && (
                          <TableCell sx={{ width: 48 }}>
                            <Tooltip title="Quitar de la lista">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setFilas((a) => a.filter((_, j) => j !== i))}
                              >
                                <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {filas && !filas.length && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        La lista está vacía: mientras lo esté, decide el padrón de la API.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {editando && (
              <Button
                size="small"
                sx={{ mt: 1.5 }}
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => setFilas((a) => [...a, filaVacia()])}
              >
                Agregar destacamento
              </Button>
            )}
            <Box sx={{ mt: 3, maxWidth: 560, mx: 'auto' }}>
              <Typography variant="body2" fontStyle="italic">
                *Dest. Reconocido en último semestre de 2025
              </Typography>
              <Typography variant="body2" fontStyle="italic">
                **Dest. Reconocido en 2026
              </Typography>
              <Typography
                variant="body2"
                fontWeight={700}
                fontStyle="italic"
                sx={{ mt: 1, borderBottom: '1px solid #171b27' }}
              >
                Leyenda
              </Typography>
              {LEYENDA_REPORTE_REGISTRO.map(({ codigo, descripcion }) => (
                <Box key={codigo} sx={{ display: 'flex', gap: 2, py: 0.35 }}>
                  <Typography variant="body2" sx={{ width: 70, flexShrink: 0, textAlign: 'right' }}>
                    {codigo}
                  </Typography>
                  <Typography variant="body2" fontStyle="italic">
                    {descripcion}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}
            useFlexGap
          >
            {editando && (
              <Button
                color="inherit"
                onClick={() => {
                  setEditando(false);
                  leerConfiguracionMembresia().then((c) => setFilas(c.inscritos2026));
                }}
              >
                Descartar
              </Button>
            )}
            {!editando && (
              <LoadingButton
                variant="outlined"
                loading={descargando}
                disabled={!filas?.length}
                onClick={descargar}
                startIcon={<Iconify icon="solar:download-bold" />}
              >
                Descargar PDF
              </LoadingButton>
            )}
            {editando ? (
              <LoadingButton variant="contained" loading={guardando} onClick={guardar}>
                Guardar lista
              </LoadingButton>
            ) : (
              <Button
                variant="contained"
                disabled={!filas}
                onClick={() => setEditando(true)}
                startIcon={<Iconify icon="solar:pen-bold" />}
              >
                Editar lista
              </Button>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
}
