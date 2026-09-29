'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';

import { GRUPOS_DE_CAMPOS } from 'src/utils/campos-de-carga.mjs';

import { cargarActualizaciones } from 'src/services/actualizaciones-destacamentos-service';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// "CARGAR POR CAMPOS": se eligen los datos del envío que se aplican, se ve antes
// qué cambiaría en cada destacamento y solo entonces se carga. Sirve para
// arreglar un dato (un teléfono, el coordinador) sin volver a escribir el resto
// del envío encima de lo que alguien ya corrigió a mano.
// ----------------------------------------------------------------------

export function CargaPorCamposDialog({ open, onClose, filas = [], user, onTerminado }) {
  const [elegidos, setElegidos] = useState([]);
  const [vista, setVista] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Cambiar la elección deja vieja la vista previa.
  const cambiar = (ids, marcar) => {
    setVista(null);
    setElegidos((prev) =>
      marcar ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id))
    );
  };

  const cerrar = () => {
    if (cargando) return;
    setVista(null);
    setError('');
    onClose();
  };

  const verCambios = async () => {
    setSimulando(true);
    setError('');
    try {
      const { vista: resultado = [], omitidas = [] } = await cargarActualizaciones(filas, user, {
        campos: elegidos,
        simular: true,
      });
      setVista([
        ...resultado,
        ...omitidas.map((nombre) => ({
          id: `omitida-${nombre}`,
          nombre,
          cambios: [],
          avisos: ['Destacamento nuevo: se crea desde Destacamentos.'],
        })),
      ]);
    } catch (fallo) {
      setError(fallo?.message || 'No se pudo calcular qué cambiaría.');
    } finally {
      setSimulando(false);
    }
  };

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const resultado = await cargarActualizaciones(filas, user, { campos: elegidos });
      setVista(null);
      onTerminado?.(resultado);
      onClose();
    } catch (fallo) {
      setError(fallo?.message || 'No se pudo cargar.');
    } finally {
      setCargando(false);
    }
  };

  const conCambios = vista?.filter((v) => v.cambios.length).length ?? 0;

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={cerrar}>
      <DialogTitle>
        Cargar por campos
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {filas.length} envío{filas.length === 1 ? '' : 's'} marcado{filas.length === 1 ? '' : 's'}
          . Solo se escribe lo que difiere de lo que ya hay en la aplicación.
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {GRUPOS_DE_CAMPOS.map(({ grupo, campos }) => {
            const ids = campos.map((c) => c.id);
            const todos = ids.every((id) => elegidos.includes(id));
            return (
              <Box key={grupo}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                  <Typography variant="subtitle2">{grupo}</Typography>
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => cambiar(ids, !todos)}
                  >
                    {todos ? 'Ninguno' : 'Todos'}
                  </Link>
                </Stack>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    columnGap: 2,
                  }}
                >
                  {campos.map(({ id, etiqueta }) => (
                    <FormControlLabel
                      key={id}
                      label={etiqueta}
                      slotProps={{ typography: { variant: 'body2' } }}
                      control={
                        <Checkbox
                          size="small"
                          checked={elegidos.includes(id)}
                          onChange={(evento) => cambiar([id], evento.target.checked)}
                        />
                      }
                    />
                  ))}
                </Box>
              </Box>
            );
          })}

          {error && <Alert severity="error">{error}</Alert>}

          {vista && (
            <>
              <Divider />
              <Typography variant="subtitle2">
                Qué cambiaría ({conCambios} de {vista.length} con cambios)
              </Typography>
              <Stack spacing={1.5}>
                {vista.map((v) => (
                  <Box key={v.id}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {v.nombre}
                    </Typography>
                    {v.cambios.length ? (
                      v.cambios.map((c) => (
                        <Typography key={c} variant="body2" sx={{ pl: 2 }}>
                          • {c}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="body2" sx={{ pl: 2, color: 'text.secondary' }}>
                        Sin cambios
                      </Typography>
                    )}
                    {(v.avisos || []).map((a) => (
                      <Typography key={a} variant="body2" sx={{ pl: 2, color: 'warning.main' }}>
                        ⚠ {a}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={cerrar} disabled={cargando}>
          Cancelar
        </Button>
        <Button
          variant="outlined"
          startIcon={<Iconify icon="solar:eye-bold" />}
          onClick={verCambios}
          loading={simulando}
          disabled={!elegidos.length || cargando}
        >
          Ver cambios
        </Button>
        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:check-circle-bold" />}
          onClick={cargar}
          loading={cargando}
          disabled={!elegidos.length || simulando}
        >
          Cargar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
