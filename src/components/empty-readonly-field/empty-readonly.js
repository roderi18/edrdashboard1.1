// ----------------------------------------------------------------------
// Estado vacío de los campos NO editables.
//
// Cuando un campo no se puede editar (rol sin permiso, campo calculado, sección
// en solo lectura) y además no tiene valor, dejarlo en blanco no comunica nada:
// el usuario no sabe si el dato falta o si la vista fallo. En ese caso se muestra
// "Sin información registrada" como marcador de posición.
//
// Es solo presentación: NUNCA se toca el valor del formulario, así que el campo
// sigue vacío para la validación y para el guardado.
// ----------------------------------------------------------------------

export const EMPTY_READONLY_TEXT = 'Sin información registrada';

export const isEmptyFieldValue = (value) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';

  return false;
};

// Estilo del marcador de posición: en CURSIVA, para que se distinga a simple
// vista de un valor real escrito por el usuario.
export const EMPTY_READONLY_SX = { fontStyle: 'italic' };

// Se aplica sobre el elemento `input`, que es donde vive el placeholder.
export const EMPTY_READONLY_INPUT_SX = { '&::placeholder': { fontStyle: 'italic' } };

// Devuelve los props que hay que fusionar en el campo, o `null` si no aplica.
// El label se fija en `shrink` porque, sin eso, MUI lo dibuja sobre el area del
// input y el marcador de posición no llegaria a verse.
export const buildEmptyReadOnlyProps = ({
  notEditable = false,
  value,
  placeholder,
  slotProps,
} = {}) => {
  // Un placeholder propio del campo manda sobre el generico.
  if (!notEditable || placeholder || !isEmptyFieldValue(value)) return null;

  return {
    placeholder: EMPTY_READONLY_TEXT,
    inputSx: EMPTY_READONLY_INPUT_SX,
    slotProps: {
      ...slotProps,
      inputLabel: { ...slotProps?.inputLabel, shrink: true },
    },
  };
};
