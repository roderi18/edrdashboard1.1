'use client';

import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

const getOptionValue = (option) => option?.value ?? option;

const getOptionLabel = (option) => String(option?.label ?? getOptionValue(option) ?? '');

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
            width: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {filtersConfig.map((filter) => (
            <FormControl key={filter.key} fullWidth>
              <InputLabel id={`${filter.key}-label`}>{filter.label}</InputLabel>
              <Select
                labelId={`${filter.key}-label`}
                label={filter.label}
                multiple
                value={filter.value}
                onChange={(event) => {
                  const newValue =
                    typeof event.target.value === 'string'
                      ? event.target.value.split(',')
                      : event.target.value;

                  filter.onChange?.({
                    ...event,
                    target: {
                      value: Array.isArray(newValue)
                        ? newValue.filter((value) => value !== '' && value != null)
                        : [],
                    },
                  });
                }}
                renderValue={(selected) =>
                  selected
                    .map((value) => {
                      const found = (filter.options || []).find(
                        (option) => String(getOptionValue(option)) === String(value)
                      );

                      return found ? getOptionLabel(found) : value;
                    })
                    .join(', ')
                }
                MenuProps={{
                  disableAutoFocusItem: true,
                  disableScrollLock: true,
                  slotProps: {
                    paper: {
                      sx: {
                        maxHeight: '40vh',
                        overflow: 'auto',
                      },
                    },
                  },
                }}
              >
                {(filter.options || []).map((option, index) => {
                  const value = getOptionValue(option);

                  return (
                    <MenuItem key={`${filter.key}-${value}-${index}`} value={value}>
                      <Checkbox size="small" checked={filter.value.includes(value)} />
                      {getOptionLabel(option)}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          ))}
        </Box>
      </CustomPopover>
    </>
  );
}
