import { Controller, useFormContext } from 'react-hook-form';

import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';

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
      render={({ field, fieldState: { error } }) => (
        <Autocomplete
          {...field}
          id={`${name}-rhf-autocomplete`}
          onChange={(event, newValue) => setValue(name, newValue, { shouldValidate: true })}
          renderOption={
            renderOption ||
            ((props, option, state) => {
              const { key, ...optionProps } = props;

              return (
                <li key={key ?? `${name}-${getDefaultOptionKey(option, state.index)}`} {...optionProps}>
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
              placeholder={placeholder}
              error={!!error}
              helperText={error?.message ?? helperText}
              slotProps={{
                ...textField?.slotProps,
                htmlInput: {
                  ...params.inputProps,
                  ...textField?.slotProps?.htmlInput,
                  autoComplete: 'new-password', // Disable autocomplete and autofill
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
      )}
    />
  );
}
