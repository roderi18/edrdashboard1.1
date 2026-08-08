import { Controller, useFormContext } from 'react-hook-form';
import { transformValue, transformValueOnBlur, transformValueOnChange } from 'minimal-shared/utils';

import TextField from '@mui/material/TextField';

import { buildEmptyReadOnlyProps } from 'src/components/empty-readonly-field';

// ----------------------------------------------------------------------

export function RHFTextField({ name, helperText, slotProps, type = 'text', ...other }) {
  const { control } = useFormContext();

  const isNumberType = type === 'number';
  // Campo no editable: deshabilitado o marcado como solo lectura.
  const notEditable = Boolean(other.disabled || slotProps?.input?.readOnly);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        // Sin valor y sin poder editarlo: se muestra "Sin información registrada".
        const emptyReadOnly = buildEmptyReadOnlyProps({
          notEditable,
          value: field.value,
          placeholder: other.placeholder,
          slotProps,
        });

        return (
        <TextField
          {...field}
          fullWidth
          // value={isNumberType ? transformValue(field.value) : field.value} 
          value={isNumberType ? transformValue(field.value ?? '') : field.value ?? ''}
          onChange={(event) => {
            const transformedValue = isNumberType
              ? transformValueOnChange(event.target.value)
              : event.target.value;

            field.onChange(transformedValue);
          }}
          onBlur={(event) => {
            const transformedValue = isNumberType
              ? transformValueOnBlur(event.target.value)
              : event.target.value;

            field.onChange(transformedValue);
          }}
          type={isNumberType ? 'text' : type}
          error={!!error}
          helperText={error?.message ?? helperText}
          slotProps={{
            ...slotProps,
            ...emptyReadOnly?.slotProps,
            htmlInput: {
              ...slotProps?.htmlInput,
              ...(isNumberType && {
                inputMode: 'decimal',
                pattern: '[0-9]*\\.?[0-9]*',
              }),
              autoComplete: 'new-password', // Disable autocomplete and autofill
              ...(emptyReadOnly && {
                sx: { ...slotProps?.htmlInput?.sx, ...emptyReadOnly.inputSx },
              }),
            },
          }}
          {...other}
          {...(emptyReadOnly?.placeholder && { placeholder: emptyReadOnly.placeholder })}
        />
        );
      }}
    />
  );
}
