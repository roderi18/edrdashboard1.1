'use client';

import { useRef } from 'react';

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
import { filtrarPorNombreComoElBuscador } from 'src/utils/buscador-organizacion.mjs';

// ----------------------------------------------------------------------
// Dialogo de "Asignar / Cambiar miembro" de las Directivas. Es el mismo que usa
// el organigrama del destacamento; vive aparte para que seccion y region no lo
// dupliquen.
// ----------------------------------------------------------------------

const getMemberAvatar = (member) => member?.avatarUrl || member?.photoURL || '';

// Busca como el buscador de la cabecera: palabras sueltas, en cualquier orden,
// con erratas, y tambien por codigo de miembro.
const filtrarMiembros = filtrarPorNombreComoElBuscador(
  (opcion) => opcion?.nombre,
  (opcion) => opcion?.member?.memberId ?? opcion?.codigo
);

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
  const inputRef = useRef(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      // `autoFocus` solo no bastaba: la transicion del dialogo le robaba el
      // foco. Se pone al terminar de abrirse.
      TransitionProps={{ onEntered: () => inputRef.current?.focus() }}
      // Una letra pulsada con el foco en cualquier otra parte del dialogo va al
      // buscador: se enfoca antes de que el navegador escriba la tecla.
      onKeyDown={(event) => {
        const input = inputRef.current;
        if (!input || event.target === input) return;
        if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
        input.focus();
      }}
    >
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
            filterOptions={filtrarMiembros}
            getOptionKey={(option) => option?.id}
            // Quien ya ocupa otro cargo se lista, pero no se puede elegir.
            getOptionDisabled={(option) => Boolean(option?.disabled)}
            isOptionEqualToValue={(option, selected) => option?.id === selected?.id}
            noOptionsText="No hay miembros disponibles en este nivel"
            renderOption={(optionProps, option) => {
              const { key, ...liProps } = optionProps;
              // Quien ya tiene cargo se ve APAGADO y va al final, para que se
              // note de un vistazo quien esta libre. Apagado, no bloqueado: se
              // puede elegir igual, y entonces se pregunta.
              const ocupado = Boolean(option.rolActual || option.rolEnOtroConsejo);

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
                  // Apagado lo justo para distinguirse: a 0.5 el texto no se
                  // leia, que es peor que no atenuarlo.
                  sx={{ alignItems: 'flex-start', opacity: ocupado ? 0.75 : 1, ...liProps.sx }}
                >
                  <Avatar
                    alt={option.nombre}
                    src={getMemberAvatar(option.member)}
                    sx={{ width: 36, height: 36, mr: 1.5, mt: 0.25, flexShrink: 0 }}
                  />

                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2">{option.nombre}</Typography>

                    {/* De donde viene la persona. */}
                    <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                      {option.subtitulo}
                    </Typography>

                    {/* Cargo que ya ocupa, con la seccion o region a la que
                        pertenece. El de OTRA directiva no impide elegirla: al
                        asignar se pregunta si se le quita de alli. */}
                    {(option.rolActual || option.rolEnOtroConsejo) && (
                      <Typography
                        variant="caption"
                        component="div"
                        sx={{ color: 'text.secondary', fontWeight: 'fontWeightSemiBold' }}
                      >
                        Ya es {option.rolActual || option.rolEnOtroConsejo}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            }}
            renderInput={(autocompleteParams) => (
              // Se abre para buscar a alguien por nombre: el foco va directo al
              // campo, sin que haya que hacerle clic primero. Va en el TextField:
              // puesto en el Autocomplete no llegaba al input y no hacia nada.
              <TextField
                {...autocompleteParams}
                inputRef={inputRef}
                autoFocus
                label="Miembro"
                placeholder="Buscar miembro"
              />
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
