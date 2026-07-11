'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

// El coordinador puede: editar el valor propuesto de cada campo, rechazar un
// campo individual (se mantiene el actual), aprobar solo los seleccionados, o
// aprobar todos. `onResolve` recibe la lista de campos con su decision final.
export function MemberChangeRequestDialog({ open, solicitud, saving = false, onClose, onResolve }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!solicitud) {
      setRows([]);
      return;
    }

    setRows(
      (solicitud.cambios || []).map((cambio) => ({
        ...cambio,
        valorFinal: cambio.despues ?? '',
        rechazado: false,
      }))
    );
  }, [solicitud]);

  const setRow = (index, patch) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  // aprobarTodos=true aplica todos los campos (ignora los rechazos por campo);
  // aprobarTodos=false aplica solo los que no fueron rechazados.
  const resolver = (aprobarTodos) => {
    const decision = rows.map((row) => {
      const aprobado = aprobarTodos ? true : !row.rechazado;

      return {
        campo: row.campo,
        label: row.label,
        antes: row.antes ?? '',
        aprobado,
        valorFinal: aprobado ? row.valorFinal : row.antes ?? '',
        editado: String(row.valorFinal ?? '') !== String(row.despues ?? ''),
      };
    });

    onResolve?.(decision);
  };

  const rechazarTodo = () => {
    onResolve?.(
      rows.map((row) => ({
        campo: row.campo,
        label: row.label,
        antes: row.antes ?? '',
        aprobado: false,
        valorFinal: row.antes ?? '',
        editado: false,
      }))
    );
  };

  const haySeleccionados = rows.some((row) => !row.rechazado);

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="small"
            onClick={onClose}
            disabled={saving}
            aria-label="Cerrar"
            sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
          >
            <Iconify icon="mingcute:close-line" />
          </IconButton>
          <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.dark' }}>
            {getInitials(solicitud?.nombreMiembro)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {solicitud?.nombreMiembro || 'Miembro'}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <Box
                component="span"
                sx={{
                  px: 0.75,
                  borderRadius: 0.75,
                  typography: 'caption',
                  fontFamily: 'monospace',
                  bgcolor: 'background.neutral',
                }}
              >
                {solicitud?.codigoMiembro || '—'}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Enviado por {solicitud?.solicitadoPorNombre || 'Líder de Grupo'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          Puedes editar el valor, rechazar un campo, o aprobar todo.
        </Typography>

        <Stack spacing={2}>
          {rows.map((row, index) => (
            <Stack
              key={row.campo}
              direction="row"
              spacing={1}
              alignItems="flex-end"
              sx={{ opacity: row.rechazado ? 0.55 : 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label={row.label}
                value={row.rechazado ? row.antes ?? '' : row.valorFinal ?? ''}
                disabled={row.rechazado}
                onChange={(event) => setRow(index, { valorFinal: event.target.value })}
                helperText={
                  <Box component="span" sx={{ color: 'text.disabled' }}>
                    Antes:{' '}
                    <Box component="span" sx={{ textDecoration: 'line-through' }}>
                      {row.antes || '(vacío)'}
                    </Box>
                    {row.rechazado ? ' · se mantiene el actual' : null}
                  </Box>
                }
                sx={{
                  '& .MuiInputBase-root': {
                    ...(!row.rechazado && {
                      '& fieldset': { borderColor: 'success.main' },
                    }),
                  },
                }}
              />

              <Tooltip title={row.rechazado ? 'Restaurar cambio' : 'Rechazar este campo'}>
                <IconButton
                  color={row.rechazado ? 'error' : 'default'}
                  onClick={() => setRow(index, { rechazado: !row.rechazado })}
                  sx={{ mb: 2.5 }}
                >
                  <Iconify icon={row.rechazado ? 'solar:restart-bold' : 'mingcute:close-line'} />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Button color="error" variant="text" disabled={saving} onClick={rechazarTodo}>
          Rechazar todo
        </Button>

        <Stack direction="row" spacing={1}>
          <LoadingButton
            color="inherit"
            variant="outlined"
            loading={saving}
            disabled={!haySeleccionados}
            onClick={() => resolver(false)}
          >
            Aprobar seleccionados
          </LoadingButton>
          <LoadingButton
            color="success"
            variant="contained"
            loading={saving}
            startIcon={<Iconify icon="solar:check-read-linear" />}
            onClick={() => resolver(true)}
          >
            Aprobar todos
          </LoadingButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
