import { merge } from 'es-toolkit';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { EMPTY_READONLY_SX, isEmptyFieldValue, EMPTY_READONLY_TEXT } from 'src/components/empty-readonly-field';

import { HelperText } from './help-text';

// ----------------------------------------------------------------------

export function RHFSelect({ name, children, helperText, slotProps = {}, ...other }) {
  const { control } = useFormContext();

  const labelId = `${name}-select`;
  // Campo no editable: deshabilitado o marcado como solo lectura.
  const notEditable = Boolean(other.disabled || slotProps?.input?.readOnly);

  const baseSlotProps = {
    select: {
      sx: { textTransform: 'capitalize' },
      MenuProps: {
        slotProps: {
          paper: {
            sx: { maxHeight: 240 },
          },
        },
      },
    },
    htmlInput: { id: labelId },
    inputLabel: { htmlFor: labelId },
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        // Sin valor y sin poder editarlo: el Select no admite placeholder, asi que
        // se dibuja el texto con `renderValue` (no altera el valor del formulario).
        const showEmptyText = notEditable && isEmptyFieldValue(field.value);
        const emptySlotProps = showEmptyText
          ? {
              select: {
                displayEmpty: true,
                renderValue: () => (
                  <Box component="span" sx={{ color: 'text.disabled', ...EMPTY_READONLY_SX }}>
                    {EMPTY_READONLY_TEXT}
                  </Box>
                ),
              },
              inputLabel: { shrink: true },
            }
          : {};

        return (
          <TextField
            {...field}
            select
            fullWidth
            error={!!error}
            helperText={error?.message ?? helperText}
            slotProps={merge(merge(baseSlotProps, slotProps), emptySlotProps)}
            {...other}
          >
            {children}
          </TextField>
        );
      }}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFMultiSelect({
  name,
  chip,
  label,
  options,
  checkbox,
  placeholder,
  slotProps,
  helperText,
  ...other
}) {
  const { control } = useFormContext();

  const labelId = `${name}-multi-select`;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const renderLabel = () => (
          <InputLabel htmlFor={labelId} {...slotProps?.inputLabel}>
            {label}
          </InputLabel>
        );

        const renderOptions = () =>
          options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {checkbox && (
                <Checkbox
                  size="small"
                  disableRipple
                  checked={field.value.includes(option.value)}
                  {...slotProps?.checkbox}
                />
              )}

              {option.label}
            </MenuItem>
          ));

        return (
          <FormControl error={!!error} {...other}>
            {label && renderLabel()}

            <Select
              {...field}
              multiple
              displayEmpty={!!placeholder}
              label={label}
              renderValue={(selected) => {
                const selectedItems = options.filter((item) => selected.includes(item.value));

                if (!selectedItems.length && placeholder) {
                  return <Box sx={{ color: 'text.disabled' }}>{placeholder}</Box>;
                }

                if (chip) {
                  return (
                    <Box sx={{ gap: 0.5, display: 'flex', flexWrap: 'wrap' }}>
                      {selectedItems.map((item) => (
                        <Chip
                          key={item.value}
                          size="small"
                          variant="soft"
                          label={item.label}
                          {...slotProps?.chip}
                        />
                      ))}
                    </Box>
                  );
                }

                return selectedItems.map((item) => item.label).join(', ');
              }}
              {...slotProps?.select}
              inputProps={{
                id: labelId,
                ...slotProps?.select?.inputProps,
              }}
            >
              {renderOptions()}
            </Select>

            <HelperText
              {...slotProps?.helperText}
              errorMessage={error?.message}
              helperText={helperText}
            />
          </FormControl>
        );
      }}
    />
  );
}
