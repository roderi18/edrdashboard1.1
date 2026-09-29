'use client';

import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import {
  leerOpcionesDeEnvioNuevo,
  crearDestacamentoDesdeEnvio,
  actualizarEnvioSobreDestacamento,
} from 'src/services/actualizaciones-destacamentos-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------
// "¿Es uno que ya existe?" para los envíos de destacamento nuevo. Antes la
// carga los saltaba siempre ("créalo en Destacamentos"), aunque existiera (el
// "leones de Sion 275" es el 275). Dos salidas, las dos con confirmación:
// actualizar sobre un destacamento del padrón (propone los de mismo número o
// nombre) o crearlo nuevo, que solo se habilita si ninguno coincide.
// ----------------------------------------------------------------------

const etiquetaDe = (d) =>
  d ? [d.numero ? `#${d.numero}` : 'Sin número', d.nombre].filter(Boolean).join(' · ') : '';

export function ResolverDestacamentoNuevo({ fila, user, onTerminado }) {
  const [opciones, setOpciones] = useState(null);
  const [error, setError] = useState('');
  const [elegido, setElegido] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // 'actualizar' | 'crear'

  useEffect(() => {
    let vivo = true;
    leerOpcionesDeEnvioNuevo(fila)
      .then((o) => {
        if (!vivo) return;
        setOpciones(o);
        setElegido(o.candidatos[0]?.destacamento || null);
      })
      .catch((e) => vivo && setError(e.message || 'No se pudo leer el padrón.'));
    return () => {
      vivo = false;
    };
  }, [fila]);

  const ejecutar = async () => {
    try {
      const resultado =
        confirmar === 'crear'
          ? await crearDestacamentoDesdeEnvio(fila, user)
          : await actualizarEnvioSobreDestacamento(fila, elegido.idDestacamento, user);
      setConfirmar(null);
      onTerminado?.(resultado);
    } catch (e) {
      console.error('[actualizaciones de destacamentos] no se resolvió el envío nuevo', e);
      toast.error(e.message || 'No se pudo completar.');
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!opciones) return <Skeleton variant="rounded" height={120} />;

  const { padron, candidatos, puedeCrear } = opciones;
  const nombreEnvio = [fila.nombreDestacamento, fila.numeroDestacamento].filter(Boolean).join(' ');

  return (
    <Stack spacing={2} sx={{ p: 2.5, borderRadius: 1.5, border: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2">¿Qué hacer con este destacamento nuevo?</Typography>

      {candidatos.length > 0 && (
        <Alert severity="warning">
          Ya existe en la aplicación:{' '}
          {candidatos
            .map(
              (c) =>
                `${etiquetaDe(c.destacamento)} (mismo ${c.motivo === 'numero' ? 'número' : 'nombre'})`
            )
            .join(', ')}
          . Actualiza sobre él en lugar de crear uno repetido.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'center' }}>
        <Autocomplete
          fullWidth
          options={padron}
          value={elegido}
          onChange={(_, d) => setElegido(d)}
          getOptionLabel={etiquetaDe}
          isOptionEqualToValue={(a, b) => String(a.idDestacamento) === String(b.idDestacamento)}
          renderInput={(params) => (
            <TextField {...params} size="small" label="Destacamento existente" />
          )}
        />
        <Button
          variant="contained"
          disabled={!elegido}
          startIcon={<Iconify icon="solar:pen-bold" />}
          onClick={() => setConfirmar('actualizar')}
          sx={{ flexShrink: 0 }}
        >
          Actualizar sobre este
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Button
          variant="outlined"
          disabled={!puedeCrear}
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setConfirmar('crear')}
        >
          Crear como nuevo
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {puedeCrear
            ? 'Ninguno del padrón coincide por número ni por nombre.'
            : 'No disponible: ya hay uno con el mismo número o nombre.'}
        </Typography>
      </Stack>

      <ConfirmDialog
        open={!!confirmar}
        onClose={() => setConfirmar(null)}
        title={confirmar === 'crear' ? 'Crear destacamento nuevo' : 'Actualizar sobre un destacamento'}
        content={
          confirmar === 'crear'
            ? `Se creará "${nombreEnvio}" en ${fila.seccion?.nombre || 'su sección'}, con su iglesia, y se cargarán los datos del envío. ¿Continuar?`
            : `Los datos de "${nombreEnvio}" se cargarán sobre ${etiquetaDe(elegido)}. Lo que difiera se reemplazará. ¿Continuar?`
        }
        action={
          <Button variant="contained" color="primary" onClick={ejecutar}>
            Confirmar
          </Button>
        }
      />
    </Stack>
  );
}
