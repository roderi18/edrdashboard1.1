'use client';

import dayjs from 'dayjs';
import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Form } from 'src/components/hook-form';
import { Iconify } from 'src/components/iconify';

import {
  LocationSelect,
  isAddressField,
  getMemberChangeField,
  formatMemberFieldValue,
} from './member-change-request-fields';

// ----------------------------------------------------------------------

const getInitials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const normalizarValor = (valor) => {
  if (dayjs.isDayjs(valor)) return valor.format();
  return valor === null || valor === undefined ? '' : valor;
};

// El coordinador revisa cada cambio con el MISMO input del formulario de miembro
// (mismo componente, misma sanitizacion y limite de caracteres). Puede editar el
// valor propuesto, rechazar un campo (se mantiene el actual), aprobar solo los
// seleccionados o aprobar todos. `onResolve` recibe la decision final por campo.
export function MemberChangeRequestDialog({
  open,
  solicitud,
  saving = false,
  dests = [],
  onClose,
  onResolve,
  // La cabecera nombra a QUIEN o a QUE se le cambia algo. Por defecto, el
  // miembro; la bandeja de la Oficina Nacional pasa el destacamento, la seccion
  // o la region, que es lo mismo que hace este dialogo pero un nivel mas arriba.
  titulo = null,
  codigo = null,
}) {
  const cambios = useMemo(() => solicitud?.cambios || [], [solicitud]);

  // Se siembra el formulario con el snapshot completo de valores propuestos
  // (para el contexto de cascada de la direccion); si falta, se reconstruye con
  // el `despues` de cada cambio.
  const defaultValues = useMemo(() => {
    const base = { ...(solicitud?.valoresPropuestos || {}) };

    cambios.forEach((cambio) => {
      if (base[cambio.campo] === undefined) {
        base[cambio.campo] = cambio.despues ?? '';
      }
    });

    return base;
  }, [solicitud, cambios]);

  const methods = useForm({ defaultValues });

  // { [campo]: true } — campos rechazados por el coordinador.
  const [rechazados, setRechazados] = useState({});

  useEffect(() => {
    methods.reset(defaultValues);
    setRechazados({});
  }, [defaultValues, methods]);

  const addressCambios = cambios.filter((cambio) => isAddressField(cambio.campo));
  const otherCambios = cambios.filter((cambio) => !isAddressField(cambio.campo));

  const direccionRechazada =
    addressCambios.length > 0 && addressCambios.every((cambio) => rechazados[cambio.campo]);

  const toggleRechazo = (campo) =>
    setRechazados((current) => ({ ...current, [campo]: !current[campo] }));

  const toggleDireccion = () =>
    setRechazados((current) => {
      const next = { ...current };
      const valor = !direccionRechazada;
      addressCambios.forEach((cambio) => {
        next[cambio.campo] = valor;
      });
      return next;
    });

  const haySeleccionados = cambios.some((cambio) => !rechazados[cambio.campo]);

  // aprobarTodos=true aplica todos (ignora rechazos); false respeta los rechazos.
  const construirDecision = ({ aprobarTodos = false, rechazarTodos = false } = {}) => {
    const values = methods.getValues();

    return cambios.map((cambio) => {
      const rechazado = rechazarTodos ? true : aprobarTodos ? false : !!rechazados[cambio.campo];
      const aprobado = !rechazado;
      const valorFinal = aprobado ? normalizarValor(values[cambio.campo]) : cambio.antes ?? '';
      const valorFinalTexto = formatMemberFieldValue(cambio.campo, valorFinal, { dests });

      return {
        campo: cambio.campo,
        label: cambio.label,
        antes: cambio.antes ?? '',
        antesTexto: cambio.antesTexto ?? null,
        despues: cambio.despues ?? '',
        despuesTexto: cambio.despuesTexto ?? null,
        aprobado,
        valorFinal,
        valorFinalTexto,
        editado: valorFinalTexto !== (cambio.despuesTexto ?? ''),
      };
    });
  };

  const resolver = (opciones) => onResolve?.(construirDecision(opciones));

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
    const field = getMemberChangeField(cambio.campo);
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
          {field?.render ? (
            field.render({ disabled: rechazado, dests })
          ) : (
            <Typography variant="body2">{cambio.despuesTexto || '(vacío)'}</Typography>
          )}
          <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
            {renderAntes(cambio.antesTexto ?? cambio.antes, rechazado)}
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

  const renderDireccion = () => {
    if (!addressCambios.length) return null;

    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
        sx={{ opacity: direccionRechazada ? 0.55 : 1 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Dirección
          </Typography>

          <Box
            sx={{
              rowGap: 2.5,
              columnGap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
            }}
          >
            <LocationSelect disabled={direccionRechazada} />
          </Box>

          <Box sx={{ mt: 1 }}>
            {addressCambios.map((cambio) => (
              <Typography key={cambio.campo} variant="caption" component="div">
                {renderAntes(
                  `${cambio.label}: ${cambio.antesTexto ?? cambio.antes ?? ''}`,
                  direccionRechazada
                )}
              </Typography>
            ))}
          </Box>
        </Box>

        <Tooltip title={direccionRechazada ? 'Restaurar dirección' : 'Rechazar dirección'}>
          <IconButton
            color={direccionRechazada ? 'error' : 'default'}
            onClick={toggleDireccion}
            sx={{ mt: 1 }}
          >
            <Iconify icon={direccionRechazada ? 'solar:restart-bold' : 'mingcute:close-line'} />
          </IconButton>
        </Tooltip>
      </Stack>
    );
  };

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
            {getInitials(titulo || solicitud?.nombreMiembro)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              {titulo || solicitud?.nombreMiembro || 'Miembro'}
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
                {codigo || solicitud?.codigoMiembro || '—'}
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

        <Form methods={methods}>
          <Stack spacing={3}>
            {otherCambios.map(renderFila)}
            {renderDireccion()}
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
