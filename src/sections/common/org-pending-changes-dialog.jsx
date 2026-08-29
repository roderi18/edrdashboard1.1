'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { esSuPropiaSolicitud } from 'src/services/solicitudes-cambio-service';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// Lo que uno mando a la Oficina Nacional y todavia no le han aprobado. Mientras
// espera, la pantalla sigue mostrando los datos de antes: sin esta ventana no
// habria forma de recordar QUE fue lo que se envio.
//
// Sirve igual para secciones y para regiones: la propuesta tiene la misma forma
// en ambas (ver `proponerCambio`).

const formatFecha = (value) => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const textoValor = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '(vacío)';

  return String(valor);
};

// Una foto no se lee: se mira. Volcar la URL entera llenaba la ventana de texto
// que no le dice nada a nadie.
const esUrlDeImagen = (valor) => /^https?:\/\//i.test(String(valor || ''));

const ValorCampo = ({ valor, tachado = false }) =>
  esUrlDeImagen(valor) ? (
    <Box
      component="img"
      src={String(valor)}
      alt=""
      sx={{
        width: 56,
        height: 56,
        borderRadius: 1,
        objectFit: 'cover',
        opacity: tachado ? 0.5 : 1,
      }}
    />
  ) : (
    <Typography
      variant="body2"
      sx={{
        color: tachado ? 'text.disabled' : 'text.primary',
        textDecoration: tachado ? 'line-through' : 'none',
      }}
    >
      {textoValor(valor)}
    </Typography>
  );

export function OrgPendingChangesDialog({
  open,
  solicitudes = [],
  entidad = '',
  usuario = null,
  // Retira la propuesta. Lo recibe el formulario, que es quien sabe recargar lo
  // que queda pendiente despues.
  onDescartar,
  descartando = false,
  onClose,
}) {
  const lista = Array.isArray(solicitudes) ? solicitudes : [];
  // Solo se retira lo propio: lo que mando otro no se toca desde aqui, y quien
  // resuelve tiene su bandeja para aprobar o rechazar.
  const propias = lista.filter((solicitud) => esSuPropiaSolicitud(solicitud, usuario));

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 1.5 }}>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Cerrar"
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <Iconify icon="mingcute:close-line" />
        </IconButton>

        <Stack spacing={0.5}>
          <Typography variant="subtitle1">Cambios pendientes</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {entidad
              ? `${entidad} · en espera de la Oficina Nacional`
              : 'En espera de la Oficina Nacional'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {!lista.length ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No hay cambios en espera de aprobación.
          </Typography>
        ) : (
          <Stack spacing={2.5}>
            {lista.map((solicitud, indice) => (
              <Stack key={solicitud.id || indice} spacing={1.5}>
                {indice > 0 && <Divider />}

                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                  <Chip size="small" variant="soft" color="warning" label="Pendiente de aprobación" />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Enviado por {solicitud?.solicitadoPorNombre || 'ti'}
                    {solicitud?.creadoEn ? ` · ${formatFecha(solicitud.creadoEn)}` : ''}
                  </Typography>
                </Stack>

                {(solicitud?.cambios || []).map((campo, posicion) => (
                  <Box
                    key={campo?.campo || posicion}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.neutral',
                    }}
                  >
                    <Typography variant="subtitle2">
                      {campo?.etiqueta || campo?.label || campo?.campo}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <ValorCampo valor={campo?.antes} tachado />
                      <Iconify
                        width={16}
                        icon="eva:arrow-forward-fill"
                        sx={{ color: 'text.disabled' }}
                      />
                      <ValorCampo valor={campo?.despues} />
                    </Stack>
                  </Box>
                ))}

                {!solicitud?.cambios?.length && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    La propuesta no detalla campos.
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {/* Retirar lo que uno mando no es rechazarlo: nadie lo juzgo, se
            arrepintio quien lo envio. Sin esto la propuesta se quedaba en la
            bandeja de la Oficina Nacional pidiendo una revision que ya no hacia
            falta. */}
        {Boolean(onDescartar) && propias.length > 0 && (
          <Button
            color="error"
            variant="outlined"
            loading={descartando}
            onClick={() => onDescartar(propias)}
          >
            {propias.length > 1 ? 'Descartar los míos' : 'Descartar'}
          </Button>
        )}

        <Button variant="contained" onClick={onClose}>
          Entendido
        </Button>
      </DialogActions>
    </Dialog>
  );
}
