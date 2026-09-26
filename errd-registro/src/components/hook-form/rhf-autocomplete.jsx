import { Controller, useFormContext } from 'react-hook-form';

import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

import { buildEmptyReadOnlyProps } from 'src/components/empty-readonly-field';

// ----------------------------------------------------------------------

const getDefaultOptionKey = (option, index) => {
  if (typeof option === 'string') {
    return `${option}-${index}`;
  }

  const value = option?.id ?? option?.value ?? option?.key;
  const label = option?.label ?? option?.name ?? '';

  return `${value ?? label}-${index}`;
};

export function RHFAutocomplete({ name, label, slotProps, helperText, placeholder, ...other }) {
  const { control, setValue } = useFormContext();

  const { textField, ...otherSlotProps } = slotProps ?? {};
  const { renderOption, ...autocompleteProps } = other;
  const hidePopupIcon = autocompleteProps.disabled && autocompleteProps.forcePopupIcon === undefined;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        // El valor puede venir controlado desde fuera (p. ej. LocationSelect pasa
        // su propio `value`); si no, se usa el del formulario.
        const currentValue =
          autocompleteProps.value !== undefined ? autocompleteProps.value : field.value;
        const emptyReadOnly = buildEmptyReadOnlyProps({
          notEditable: Boolean(autocompleteProps.disabled),
          value: currentValue,
          placeholder,
          slotProps: textField?.slotProps,
        });

        return (
        <Autocomplete
          {...field}
          id={`${name}-rhf-autocomplete`}
          onChange={(event, newValue) =>
            setValue(name, newValue, { shouldDirty: true, shouldValidate: true })
          }
          renderOption={
            renderOption ||
            ((props, option, state) => {
              // Se ignora `props.key` de MUI (por defecto es la etiqueta, que se
              // duplica cuando dos opciones tienen el mismo nombre). Se usa una
              // key propia que incluye el indice para garantizar unicidad.
              const optionProps = { ...props };
              delete optionProps.key;

              return (
                <li key={`${name}-${getDefaultOptionKey(option, state.index)}`} {...optionProps}>
                  {autocompleteProps.getOptionLabel?.(option) ?? option?.label ?? option?.name ?? option}
                </li>
              );
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              {...textField}
              label={label}
              placeholder={emptyReadOnly?.placeholder ?? placeholder}
              error={!!error}
              helperText={error?.message ?? helperText}
              slotProps={{
                ...textField?.slotProps,
                ...emptyReadOnly?.slotProps,
                htmlInput: {
                  ...params.inputProps,
                  ...textField?.slotProps?.htmlInput,
                  autoComplete: 'new-password', // Disable autocomplete and autofill
                  ...(emptyReadOnly && {
                    sx: { ...textField?.slotProps?.htmlInput?.sx, ...emptyReadOnly.inputSx },
                  }),
                },
              }}
            />
          )}
          slotProps={{
            ...otherSlotProps,
            chip: {
              size: 'small',
              variant: 'soft',
              ...otherSlotProps?.chip,
            },
          }}
          {...autocompleteProps}
          forcePopupIcon={hidePopupIcon ? false : autocompleteProps.forcePopupIcon}
        />
        );
      }}
    />
  );
}
