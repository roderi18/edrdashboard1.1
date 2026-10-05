import TextField from '@mui/material/TextField';

import { EMPTY_READONLY_TEXT, EMPTY_READONLY_INPUT_SX } from './empty-readonly';

// ----------------------------------------------------------------------
// Campo de solo lectura SIN valor registrado. Muestra "Sin información
// registrada" en cursiva.
//
// Se usa cuando el campo se sustituye por completo (no hay input real que
// rellenar): p. ej. la dirección de un miembro cuyos datos no se pueden ver, o un
// cargo sin asignar en una sección de solo lectura.
//
// Diferencia con `MaskedField`: aquel OCULTA un valor que sí existe (asteriscos);
// este comunica que NO hay dato registrado.
// ----------------------------------------------------------------------

export function EmptyReadOnlyField({ label, ...other }) {
  return (
    <TextField
      fullWidth
      disabled
      label={label}
      value=""
      placeholder={EMPTY_READONLY_TEXT}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: { sx: EMPTY_READONLY_INPUT_SX },
      }}
      {...other}
    />
  );
}
