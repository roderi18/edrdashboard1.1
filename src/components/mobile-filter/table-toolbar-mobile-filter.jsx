'use client';

import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

const getOptionValue = (option) => option?.value ?? option;

const getOptionLabel = (option) => String(option?.label ?? getOptionValue(option) ?? '');

const getAutocompleteValue = (selectedValues = [], options = []) =>
  selectedValues.map((value) => {
    const found = options.find((option) => String(getOptionValue(option)) === String(value));

    return found || { value, label: String(value) };
  });

export function TableToolbarMobileFilter({ filtersConfig = [], hasActiveFilters = false }) {
  const popover = usePopover();

  return (
    <>
      <Box
        sx={(theme) => {
          const selected = popover.open;

          return {
            width: 54,
            height: 54,
            borderRadius: 1,
            border: `1px solid ${theme.vars.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: selected ? theme.vars.palette.action.selected : 'transparent',
            transition: 'all 0.2s ease',
          };
        }}
      >
        <Badge color="error" variant="dot" invisible={!hasActiveFilters}>
          <IconButton
            onClick={popover.onOpen}
            sx={(theme) => ({
              width: 46,
              height: 46,
              borderRadius: 1,
              transition: 'all 0.2s ease',

              '&:hover': {
                bgcolor: theme.vars.palette.action.hover,
              },
            })}
          >
            <Iconify icon="ic:round-filter-list" />
          </IconButton>
        </Badge>
      </Box>

      <CustomPopover
        open={popover.open}
        anchorEl={popover.anchorEl}
        onClose={popover.onClose}
        slotProps={{ arrow: { placement: 'top-right' } }}
      >
        <Box
          sx={{
            p: 2,
            width: 268,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {filtersConfig.map((filter) => (
            <Autocomplete
              key={filter.key}
              multiple
              disableCloseOnSelect
              options={filter.options || []}
              value={getAutocompleteValue(filter.value, filter.options || [])}
              isOptionEqualToValue={(option, value) =>
                String(getOptionValue(option)) === String(getOptionValue(value))
              }
              getOptionLabel={getOptionLabel}
              onChange={(event, selectedOptions) => {
                filter.onChange?.({
                  ...event,
                  target: {
                    value: selectedOptions.map(getOptionValue),
                  },
                });
              }}
              renderOption={(props, option, { selected }) => {
                const { key, ...optionProps } = props;

                return (
                  <li key={`${filter.key}-${getOptionValue(option)}-${key}`} {...optionProps}>
                    <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                    {getOptionLabel(option)}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={filter.label}
                  placeholder={filter.value?.length ? '' : filter.label}
                />
              )}
              slotProps={{
                paper: {
                  sx: {
                    maxHeight: '40vh',
                  },
                },
              }}
            />
          ))}
        </Box>
      </CustomPopover>
    </>
  );
}
