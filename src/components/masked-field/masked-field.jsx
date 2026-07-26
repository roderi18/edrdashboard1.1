import TextField from '@mui/material/TextField';

// ----------------------------------------------------------------------
// Campo de solo lectura con el valor OCULTO. Se usa para mostrar información
// sensible (texto, correo, teléfono, fecha, etc.) a usuarios sin permiso para
// verla: nunca recibe el valor real, solo la máscara, así no se filtra el dato.
// ----------------------------------------------------------------------

// Máscaras predefinidas más comunes. Se usan asteriscos en todas para mantener el
// mismo carácter, formato y tamaño. El teléfono conserva el formato con paréntesis.
export const MASK_PRESETS = {
  text: '**********',
  phone: '(***) ***-****',
  date: '**/**/****',
};

export function MaskedField({ label, mask = MASK_PRESETS.text, preset, ...other }) {
  const value = preset ? MASK_PRESETS[preset] ?? mask : mask;

  return (
    <TextField
      fullWidth
      disabled
      label={label}
      value={value}
      slotProps={{ inputLabel: { shrink: true } }}
      {...other}
    />
  );
}
