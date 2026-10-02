'use client';

import { useMemo, Fragment, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { fDateTime } from 'src/utils/format-time';
import { invalidarLecturas } from 'src/utils/cache-de-lecturas.mjs';
import {
  MODULO_DESIGNER,
  accionDelRegistro,
  cambiosDelRegistro,
  pestanaDelRegistro,
  personaDelRegistro,
  PESTANAS_DEL_REGISTRO,
  NOMBRE_DE_ACCION_DEL_REGISTRO,
} from 'src/utils/registro-designer.mjs';

import { listarRegistroDelDesigner } from 'src/services/audit-log-service';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// EXPLORA DESIGNER → REGISTRO (solo el Administrador Global). Todo lo guardado,
// editado y eliminado en cualquier pestaña: qué, fecha y hora, y quién. Sale de
// Historial (`registro-designer.mjs`), así que lo nuevo que entre al Designer
// por `proponerCambio` aparece aquí sin tocar esta pantalla.
// ----------------------------------------------------------------------

const COLOR_DE_ACCION = { guardar: 'success', editar: 'info', eliminar: 'error' };

const valorLegible = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'object') return JSON.stringify(valor);

  return String(valor);
};

export function EverestRegistro() {
  const [registros, setRegistros] = useState(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState('todas');
  const [buscar, setBuscar] = useState('');
  const [abierto, setAbierto] = useState(null);

  const cargar = useCallback(async ({ fresco = false } = {}) => {
    setError('');
    if (fresco) invalidarLecturas('auditoria:listarRegistroDelDesigner');

    try {
      setRegistros(await listarRegistroDelDesigner({ modulo: MODULO_DESIGNER }));
    } catch (fallo) {
      console.error('[designer] no se pudo leer el registro', fallo);
      setError('No se pudo leer el registro.');
      setRegistros((actual) => actual ?? []);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filas = useMemo(() => {
    const texto = buscar.trim().toLowerCase();

    return (registros || [])
      .map((registro) => ({
        registro,
        pestana: pestanaDelRegistro(registro),
        accion: accionDelRegistro(registro),
        persona: personaDelRegistro(registro),
      }))
      .filter((fila) => pestana === 'todas' || fila.pestana === pestana)
      .filter(
        (fila) =>
          !texto ||
          `${fila.persona} ${fila.registro.descripcion || ''} ${fila.registro.entidad?.nombre || ''}`
            .toLowerCase()
            .includes(texto)
      );
  }, [registros, pestana, buscar]);

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h6">Registro</Typography>
            {registros && <Label color="info">{filas.length}</Label>}
          </Stack>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Lo guardado, editado y eliminado en EXPLORA Designer, en todas sus pestañas: qué se
            hizo, cuándo y quién. Solo lo ve el Administrador Global.
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="Pestaña"
          value={pestana}
          onChange={(evento) => setPestana(evento.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="todas">Todas</MenuItem>
          {Object.entries(PESTANAS_DEL_REGISTRO).map(([id, nombre]) => (
            <MenuItem key={id} value={id}>
              {nombre}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          placeholder="Buscar persona o cambio…"
          value={buscar}
          onChange={(evento) => setBuscar(evento.target.value)}
          sx={{ minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          color="inherit"
          startIcon={<Iconify icon="solar:restart-bold" />}
          onClick={() => cargar({ fresco: true })}
          sx={{ flexShrink: 0 }}
        >
          Actualizar
        </Button>
      </Stack>

      {error && (
        <Typography variant="body2" sx={{ color: 'error.main', mb: 2 }}>
          {error}
        </Typography>
      )}

      {registros === null ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3, 4].map((n) => (
            <Skeleton key={n} variant="rounded" height={44} />
          ))}
        </Stack>
      ) : filas.length ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Fecha y hora</TableCell>
                <TableCell>Persona</TableCell>
                <TableCell>Pestaña</TableCell>
                <TableCell>Acción</TableCell>
                <TableCell>Qué</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map(({ registro, pestana: idPestana, accion, persona }) => {
                const cambios = cambiosDelRegistro(registro);
                const desplegado = abierto === registro.id;

                return (
                  <Fragment key={registro.id}>
                    <TableRow hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {fDateTime(registro.fecha, 'DD/MM/YYYY hh:mm A')}
                      </TableCell>
                      <TableCell>{persona}</TableCell>
                      <TableCell>{PESTANAS_DEL_REGISTRO[idPestana]}</TableCell>
                      <TableCell>
                        <Label variant="soft" color={COLOR_DE_ACCION[accion]}>
                          {NOMBRE_DE_ACCION_DEL_REGISTRO[accion]}
                        </Label>
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }}>
                        <Typography variant="body2">{registro.descripcion}</Typography>
                        {registro.entidad?.nombre && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {registro.entidad.nombre}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {!!cambios.length && (
                          <IconButton
                            size="small"
                            aria-label="Ver el detalle"
                            onClick={() => setAbierto(desplegado ? null : registro.id)}
                          >
                            <Iconify
                              width={18}
                              icon={
                                desplegado
                                  ? 'eva:arrow-ios-upward-fill'
                                  : 'eva:arrow-ios-downward-fill'
                              }
                            />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>

                    {!!cambios.length && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{ py: 0, borderBottom: desplegado ? undefined : 0 }}
                        >
                          <Collapse in={desplegado} unmountOnExit>
                            <Stack spacing={0.75} sx={{ py: 1.5 }}>
                              {cambios.map((cambio) => (
                                <Box
                                  key={cambio.campo}
                                  sx={{
                                    display: 'grid',
                                    gap: 1,
                                    gridTemplateColumns: { xs: '1fr', sm: '160px 1fr 1fr' },
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                    {cambio.campo}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'text.secondary', wordBreak: 'break-word' }}
                                  >
                                    Antes: {valorLegible(cambio.antes)}
                                  </Typography>
                                  <Typography variant="caption" sx={{ wordBreak: 'break-word' }}>
                                    Después: {valorLegible(cambio.despues)}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          No hay nada registrado con estos filtros.
        </Typography>
      )}
    </Card>
  );
}
