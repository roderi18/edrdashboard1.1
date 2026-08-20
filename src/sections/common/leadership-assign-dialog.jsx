'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';

import { getLeadershipScopeLabel } from 'src/utils/leadership-member-options';

// ----------------------------------------------------------------------
// Dialogo de "Asignar / Cambiar miembro" de las Directivas. Es el mismo que usa
// el organigrama del destacamento; vive aparte para que seccion y region no lo
// dupliquen.
// ----------------------------------------------------------------------

const getMemberAvatar = (member) => member?.avatarUrl || member?.photoURL || '';

const memberKey = (member) => String(member?.id ?? member?.idMiembros ?? '').trim();

export function LeadershipAssignDialog({
  open,
  node,
  nivel,
  nombreEntidad,
  options = [],
  loading = false,
  value,
  onChange,
  onClose,
  onSubmit,
  saving = false,
  yaAsignado = false,
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{yaAsignado ? 'Cambiar miembro' : 'Asignar miembro'}</DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {node?.role || 'Cargo de la directiva'}
            </Typography>

            {/* De donde salen los miembros de la lista. */}
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {getLeadershipScopeLabel({ nivel, nombreEntidad })}
            </Typography>
          </Box>

          <Autocomplete
            options={options}
            // Se compara por id, no por identidad de objeto: los miembros llegan
            // de servicios distintos y una misma persona puede ser dos objetos.
            value={options.find((option) => option.id === memberKey(value)) || null}
            loading={loading}
            onChange={(event, option) => onChange?.(option?.member ?? null)}
            getOptionLabel={(option) => option?.nombre || ''}
            getOptionKey={(option) => option?.id}
            // Quien ya ocupa otro cargo se lista, pero no se puede elegir.
            getOptionDisabled={(option) => Boolean(option?.disabled)}
            isOptionEqualToValue={(option, selected) => option?.id === selected?.id}
            noOptionsText="No hay miembros disponibles en este nivel"
            renderOption={(optionProps, option) => {
              const { key, ...liProps } = optionProps;

              return (
                // El texto que no cabe BAJA DE LINEA en vez de recortarse: la
                // procedencia ("Región Central · Este Oriental I · Casa Dios")
                // no cabe de una vez y truncarla dejaba el destacamento en
                // puntos suspensivos, que es justo el dato que distingue a dos
                // personas con el mismo nombre. El avatar se alinea arriba para
                // que no quede centrado respecto a un texto de varias lineas.
                <Box
                  key={key}
                  component="li"
                  {...liProps}
                  sx={{ alignItems: 'flex-start', ...liProps.sx }}
                >
                  <Avatar
                    alt={option.nombre}
                    src={getMemberAvatar(option.member)}
                    sx={{ width: 36, height: 36, mr: 1.5, mt: 0.25, flexShrink: 0 }}
                  />

                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{option.nombre}</Typography>

                    <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                      {option.rolActual ? `Ya es ${option.rolActual}` : option.subtitulo}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            renderInput={(autocompleteParams) => (
              <TextField {...autocompleteParams} label="Miembro" placeholder="Buscar miembro" />
            )}
          />

          {/* Acuse de recibo del clic. El hueco se reserva siempre para que el
              dialogo no pegue un salto al aparecer la barra. */}
          <Box sx={{ minHeight: 28 }}>
            {saving && (
              <>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Asignando...
                </Typography>

                <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />
              </>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Cancelar
        </Button>

        <Button variant="contained" disabled={!value || saving} onClick={onSubmit}>
          Asignar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
