'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import {
  RESULTADO_SOLICITUD_LABEL,
  clasificarResultadoSolicitud,
} from 'src/services/solicitudes-cambio-miembro-service';

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

const RESULTADO_CHIP_COLOR = {
  rechazado: 'error',
  parcial: 'warning',
  aprobado_con_cambios: 'info',
  aprobado: 'success',
};

const formatFecha = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

// Estado por campo (para el detalle).
const getEstadoCampo = (campo = {}) => {
  if (!campo.aprobado) return { label: 'Rechazado', color: 'error.main', icon: 'mingcute:close-line' };
  if (campo.editado)
    return { label: 'Aprobado con cambios', color: 'info.main', icon: 'solar:pen-bold' };
  return { label: 'Aprobado', color: 'success.main', icon: 'eva:checkmark-fill' };
};

// Muestra al solicitante que campos fueron aprobados, editados o rechazados.
export function MemberChangeResultDialog({ open, solicitud, onClose }) {
  const resultado = solicitud ? clasificarResultadoSolicitud(solicitud) : 'aprobado';
  const campos = solicitud?.resultadoCampos || [];

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="small"
            onClick={onClose}
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
                Revisado por {solicitud?.resueltoPorNombre || 'el coordinador'}
                {solicitud?.fechaResolucion ? ` · ${formatFecha(solicitud.fechaResolucion)}` : ''}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Resultado de tu solicitud:
          </Typography>
          <Chip
            size="small"
            variant="soft"
            color={RESULTADO_CHIP_COLOR[resultado] || 'default'}
            label={RESULTADO_SOLICITUD_LABEL[resultado] || 'Resuelto'}
          />
        </Stack>

        <Stack spacing={1.5}>
          {campos.map((campo) => {
            const estado = getEstadoCampo(campo);

            return (
              <Box
                key={campo.campo}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.neutral',
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography variant="subtitle2">{campo.label}</Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: estado.color }}>
                    <Iconify width={16} icon={estado.icon} />
                    <Typography variant="caption" sx={{ color: estado.color }}>
                      {estado.label}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.disabled', textDecoration: 'line-through' }}
                  >
                    {campo.antes || '(vacío)'}
                  </Typography>
                  <Iconify width={16} icon="eva:arrow-forward-fill" sx={{ color: 'text.disabled' }} />
                  <Typography
                    variant="body2"
                    sx={{ color: campo.aprobado ? 'text.primary' : 'text.disabled' }}
                  >
                    {campo.aprobado ? campo.valorFinal || '(vacío)' : campo.antes || '(vacío)'}
                    {!campo.aprobado ? ' (sin cambios)' : ''}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}
