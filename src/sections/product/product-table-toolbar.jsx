import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import { Toolbar } from '@mui/x-data-grid';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import { useTheme, useMediaQuery } from '@mui/material';

import { Iconify } from 'src/components/iconify';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';
import {
  ToolbarContainer,
  ToolbarLeftPanel,
  ToolbarRightPanel,
  CustomToolbarQuickFilter,
  CustomToolbarExportButton,
  CustomToolbarFilterButton,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

import { ProductTableFiltersResult } from './product-table-filters-result';

// ----------------------------------------------------------------------

export function ProductTableToolbar({
  options,
  filters,
  canReset,
  filteredResults,
  selectedRowCount,
  onOpenConfirmDeleteRows,
  isMemberUser = false,
  canManageStore = false,
  /********/
  settings,
  onChangeSettings,
}) {
  const { state: currentFilters, setState: updateFilters } = filters;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [stock, setStock] = useState(currentFilters.stock || []);
  const [renglon, setRenglon] = useState(currentFilters.renglon || []);

  useEffect(() => {
    setStock(currentFilters.stock || []);
    setRenglon(currentFilters.renglon || []);
  }, [currentFilters.stock, currentFilters.renglon]);

  const handleSelect = useCallback(
    (setter) => (event) => {
      const value = event.target.value;
      const parsedValue = typeof value === 'string' ? value.split(',') : value;

      setter(parsedValue);
    },
    []
  );

  const handleMobileSelect = useCallback(
    (key, setter) => (event) => {
      const value = event.target.value;
      const parsedValue = typeof value === 'string' ? value.split(',') : value;
      const nextValue = Array.isArray(parsedValue) ? parsedValue : [];

      setter(nextValue);
      updateFilters({ [key]: nextValue });
    },
    [updateFilters]
  );

  const renderLeftPanel = () =>
    isMobile ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 1 }}>
        <CustomToolbarQuickFilter
          sx={{
            flex: 1,
            minWidth: 0,
          }}
        />

        <TableToolbarMobileFilter
          hasActiveFilters={currentFilters.stock.length || currentFilters.renglon.length}
          filtersConfig={[
            {
              key: 'stock',
              label: 'Existencias',
              value: stock,
              onChange: handleMobileSelect('stock', setStock),
              options: options.stocks,
            },
            {
              key: 'renglon',
              label: 'Renglón',
              value: renglon,
              onChange: handleMobileSelect('renglon', setRenglon),
              options: options.renglones,
            },
          ]}
        />
      </Box>
    ) : (
      <>
        <CustomToolbarQuickFilter
          sx={{
            flexGrow: 0,
            flexShrink: 0,
            width: { xs: 1, md: 170 },
            minWidth: { xs: 1, md: 170 },
            maxWidth: { md: 170 },
          }}
        />

        <FilterSelect
          label="Existencias"
          value={stock}
          options={options.stocks}
          onChange={handleSelect(setStock)}
          onApply={() => updateFilters({ stock })}
          width={isMemberUser ? 200 : 170}
        />

        <FilterSelect
          label="Renglón"
          value={renglon}
          options={options.renglones}
          onChange={handleSelect(setRenglon)}
          onApply={() => updateFilters({ renglon })}
          width={150}
        />
      </>
    );

  const renderRightPanel = () => (
    <>
      {canManageStore && !!selectedRowCount && (
        <Button
          size="small"
          color="error"
          startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          onClick={onOpenConfirmDeleteRows}
        >
          Eliminar ({selectedRowCount})
        </Button>
      )}

      <CustomToolbarColumnsButton />
      <CustomToolbarFilterButton />
      <CustomToolbarExportButton />
      <CustomToolbarSettingsButton
        label="Configuracion"
        settings={settings}
        onChangeSettings={onChangeSettings}
      />
    </>
  );

  return (
    <>
      <Toolbar>
        <ToolbarContainer>
          <ToolbarLeftPanel>{renderLeftPanel()}</ToolbarLeftPanel>
          <ToolbarRightPanel>{renderRightPanel()}</ToolbarRightPanel>
        </ToolbarContainer>
      </Toolbar>

      {canReset && (
        <ProductTableFiltersResult
          filters={filters}
          totalResults={filteredResults}
          sx={{ p: 2.5, pt: 0 }}
        />
      )}
    </>
  );
}

// ----------------------------------------------------------------------

function FilterSelect({ label, value, options, onChange, onApply, width = 200 }) {
  const id = `filter-${label.toLowerCase()}-select`;
  const safeOptions = Array.isArray(options) ? options : [];

  return (
    <FormControl sx={{ flexShrink: 0, width: { xs: 1, md: width } }}>
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <Select
        multiple
        label={label}
        value={value}
        onChange={onChange}
        onClose={onApply}
        renderValue={(selected) => {
          const output = safeOptions
            .filter((opt) => selected.includes(opt.value))
            .map((opt) => opt.label);

          return output.join(', ');
        }}
        inputProps={{ id }}
      >
        {safeOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Checkbox
              disableRipple
              size="small"
              checked={value.includes(option.value)}
              slotProps={{ input: { id: `${option.value}-checkbox` } }}
            />
            {option.label}
          </MenuItem>
        ))}

        <MenuItem
          onClick={onApply}
          sx={(theme) => ({
            justifyContent: 'center',
            fontWeight: theme.typography.button,
            bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.08),
            border: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
          })}
        >
          Aplicar
        </MenuItem>
      </Select>
    </FormControl>
  );
}
