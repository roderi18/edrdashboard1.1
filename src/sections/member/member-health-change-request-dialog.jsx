'use client';

import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Form } from 'src/components/hook-form';
import { Iconify } from 'src/components/iconify';

import {
  getHealthFieldKeys,
  getHealthChangeField,
  formatHealthFieldValue,
} from './member-health-change-request-fields';

// ----------------------------------------------------------------------

// El coordinador revisa cada cambio de la Dispensa Médica con el MISMO input del
// formulario de salud (mismo componente y comportamiento). Puede editar el valor
// propuesto, rechazar un campo (se mantiene el actual), aprobar solo los
// seleccionados o aprobar todos. `onResolve(decision, datosFinales)` recibe la
// decision por campo y el objeto de valores final a persistir.
export function MemberHealthChangeRequestDialog({
  open,
  solicitud,
  saving = false,
  onClose,
  onResolve,
}) {
  const cambios = useMemo(() => solicitud?.cambios || [], [solicitud]);

  // Snapshot completo de valores propuestos (para que los inputs con contexto
  // —arreglo de medicamentos, checkboxes— tengan todo lo que necesitan).
  const defaultValues = useMemo(() => {
    const base = { ...(solicitud?.valoresPropuestos || {}) };

    cambios.forEach((cambio) => {
      getHealthFieldKeys(cambio.campo).forEach((key) => {
        if (base[key] === undefined) {
          base[key] = cambio.despues?.[key] ?? '';
        }
      });
    });

    return base;
  }, [solicitud, cambios]);

  const valoresAnteriores = useMemo(
    () => solicitud?.valoresAnteriores || {},
    [solicitud]
  );

  const methods = useForm({ defaultValues });

  // { [campo]: true } — campos rechazados por el coordinador.
  const [rechazados, setRechazados] = useState({});

  useEffect(() => {
    methods.reset(defaultValues);
    setRechazados({});
  }, [defaultValues, methods]);

  const toggleRechazo = (campo) =>
    setRechazados((current) => ({ ...current, [campo]: !current[campo] }));

  const haySeleccionados = cambios.some((cambio) => !rechazados[cambio.campo]);

  // aprobarTodos=true aplica todos (ignora rechazos); false respeta los rechazos.
  const construirResolucion = ({ aprobarTodos = false, rechazarTodos = false } = {}) => {
    const values = methods.getValues();
    // Datos finales a guardar: se parte de los valores del formulario (con las
    // ediciones del coordinador) y se revierten a "antes" los campos rechazados.
    const datosFinales = { ...values };

    const decision = cambios.map((cambio) => {
      const rechazado = rechazarTodos ? true : aprobarTodos ? false : !!rechazados[cambio.campo];
      const aprobado = !rechazado;
      const keys = getHealthFieldKeys(cambio.campo);

      if (!aprobado) {
        keys.forEach((key) => {
          datosFinales[key] = valoresAnteriores?.[key] ?? cambio.antes?.[key] ?? '';
        });
      }

      const valorFinalTexto = formatHealthFieldValue(cambio.campo, datosFinales);

      return {
        campo: cambio.campo,
        label: cambio.label,
        antes: cambio.antes ?? '',
        antesTexto: cambio.antesTexto ?? null,
        despues: cambio.despues ?? '',
        despuesTexto: cambio.despuesTexto ?? null,
        aprobado,
        valorFinal: Object.fromEntries(keys.map((key) => [key, datosFinales[key]])),
        valorFinalTexto,
        editado: valorFinalTexto !== (cambio.despuesTexto ?? ''),
      };
    });

    return { decision, datosFinales };
  };

  const resolver = (opciones) => {
    const { decision, datosFinales } = construirResolucion(opciones);
    onResolve?.(decision, datosFinales);
  };

  const renderAntes = (texto, rechazado) => (
    <Box component="span" sx={{ color: 'text.disabled' }}>
      Antes:{' '}
      <Box component="span" sx={{ textDecoration: 'line-through' }}>
        {texto || '(vacío)'}
      </Box>
      {rechazado ? ' · se mantiene el actual' : null}
    </Box>
  );

  const renderFila = (cambio) => {
    const field = getHealthChangeField(cambio.campo);
    const rechazado = !!rechazados[cambio.campo];

    return (
      <Stack
        key={cambio.campo}
        direction="row"
        spacing={1}
        alignItems="flex-start"
        sx={{ opacity: rechazado ? 0.55 : 1 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
            {cambio.label}
          </Typography>

          {field?.render ? (
            // Deshabilita todos los inputs internos del campo cuando esta rechazado.
            <Box
              component="fieldset"
              disabled={rechazado}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
            >
              {field.render()}
            </Box>
          ) : (
            <Typography variant="body2">{cambio.despuesTexto || '(vacío)'}</Typography>
          )}

          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
            {renderAntes(cambio.antesTexto ?? '', rechazado)}
          </Typography>
        </Box>

        <Tooltip title={rechazado ? 'Restaurar cambio' : 'Rechazar este campo'}>
          <IconButton
            color={rechazado ? 'error' : 'default'}
            onClick={() => toggleRechazo(cambio.campo)}
            sx={{ mt: 1 }}
          >
            <Iconify icon={rechazado ? 'solar:restart-bold' : 'mingcute:close-line'} />
          </IconButton>
        </Tooltip>
      </Stack>
    );
  };

  // Agrupa los cambios por seccion del formulario de salud, respetando el orden
  // del registro, para mostrarlos con subencabezados.
  const grupos = useMemo(() => {
    const orden = [];
    const porSeccion = {};

    cambios.forEach((cambio) => {
      const field = getHealthChangeField(cambio.campo);
      const seccion = field?.seccion || 'Otros';

      if (!porSeccion[seccion]) {
        porSeccion[seccion] = [];
        orden.push(seccion);
      }

      porSeccion[seccion].push(cambio);
    });

    return orden.map((seccion) => ({ seccion, items: porSeccion[seccion] }));
  }, [cambios]);

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
          <Avatar sx={{ bgcolor: 'error.lighter', color: 'error.dark' }}>
            <Iconify icon="solar:heart-pulse-bold" />
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
                Dispensa Médica · enviado por {solicitud?.solicitadoPorNombre || 'Líder de Grupo'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          Puedes editar el valor, rechazar un campo, o aprobar todo.
        </Typography>

        <Form methods={methods}>
          <Stack spacing={3}>
            {grupos.map((grupo) => (
              <Stack key={grupo.seccion} spacing={2}>
                <Divider textAlign="left">
                  <Typography variant="overline" sx={{ color: 'text.secondary' }}>
                    {grupo.seccion}
                  </Typography>
                </Divider>
                {grupo.items.map(renderFila)}
              </Stack>
            ))}
          </Stack>
        </Form>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Button
          color="error"
          variant="outlined"
          disabled={saving}
          onClick={() => resolver({ rechazarTodos: true })}
        >
          Rechazar todo
        </Button>

        <Stack direction="row" spacing={1}>
          <LoadingButton
            color="inherit"
            variant="outlined"
            loading={saving}
            disabled={!haySeleccionados}
            onClick={() => resolver({ aprobarTodos: false })}
          >
            Aprobar seleccionados
          </LoadingButton>
          <LoadingButton
            variant="contained"
            loading={saving}
            startIcon={<Iconify icon="solar:check-read-linear" />}
            onClick={() => resolver({ aprobarTodos: true })}
          >
            Aprobar todos
          </LoadingButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
