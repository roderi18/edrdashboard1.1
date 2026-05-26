import { useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { formHelperTextClasses } from '@mui/material/FormHelperText';

import { fDateTime } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ExportTableButton } from 'src/components/export-table-button';

// ----------------------------------------------------------------------

const INVOICE_EXPORT_COLUMNS = [
  { label: 'Recibo', value: (row) => row.invoiceNumber || row.id },
  { label: 'Cliente', value: (row) => row.invoiceTo?.name || '' },
  { label: 'Correo', value: (row) => row.invoiceTo?.company || row.invoiceTo?.email || '' },
  { label: 'Creación', value: (row) => fDateTime(row.createDate) },
  { label: 'Vence', value: (row) => fDateTime(row.dueDate) },
  { label: 'Monto', value: (row) => fDopCurrency(row.totalAmount) },
  { label: 'Enviado', value: (row) => row.sent },
  { label: 'Estado', value: (row) => row.status },
  { label: 'Items', value: (row) => (row.items || []).map((item) => item.title || item.name).join(', ') },
];

export function InvoiceTableToolbar({ filters, options, dateError, onResetPage, rows = [] }) {
  const menuActions = usePopover();

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterService = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({ service: newValue });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterStartDate = useCallback(
    (newValue) => {
      onResetPage();
      updateFilters({ startDate: newValue });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterEndDate = useCallback(
    (newValue) => {
      onResetPage();
      updateFilters({ endDate: newValue });
    },
    [onResetPage, updateFilters]
  );

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <MenuItem onClick={() => menuActions.onClose()}>
          <Iconify icon="solar:printer-minimalistic-bold" />
          Imprimir
        </MenuItem>

        <MenuItem onClick={() => menuActions.onClose()}>
          <Iconify icon="solar:import-bold" />
          Importar
        </MenuItem>

        <ExportTableButton
          rows={rows}
          columns={INVOICE_EXPORT_COLUMNS}
          pdfColumns={INVOICE_EXPORT_COLUMNS.slice(0, 8)}
          title="Lista de recibos"
          fileNamePrefix="lista-recibos"
          trigger="menuItem"
        />
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Box
        sx={{
          p: 2.5,
          gap: 2,
          display: 'flex',
          pr: { xs: 2.5, md: 1 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-end', md: 'center' },
        }}
      >
        <FormControl sx={{ flexShrink: 0, width: { xs: 1, md: 180 } }}>
          <InputLabel htmlFor="filter-service-select">Servicio</InputLabel>
          <Select
            multiple
            label="Servicio"
            value={currentFilters.service}
            onChange={handleFilterService}
            renderValue={(selected) => selected.map((value) => value).join(', ')}
            inputProps={{ id: 'filter-service-select' }}
            MenuProps={{
              slotProps: { paper: { sx: { maxHeight: 250 } } },
            }}
          >
            {options.services.map((option) => (
              <MenuItem key={option} value={option}>
                <Checkbox
                  disableRipple
                  size="small"
                  checked={currentFilters.service.includes(option)}
                  slotProps={{ input: { id: `${option}-checkbox` } }}
                />
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <DatePicker
          label="Fecha inicial"
          value={currentFilters.startDate}
          onChange={handleFilterStartDate}
          sx={{ maxWidth: { md: 180 } }}
        />

        <DatePicker
          label="Fecha final"
          value={currentFilters.endDate}
          onChange={handleFilterEndDate}
          slotProps={{
            textField: {
              error: dateError,
              helperText: dateError ? 'La fecha final debe ser posterior a la fecha inicial' : null,
            },
          }}
          sx={{
            maxWidth: { md: 180 },
            [`& .${formHelperTextClasses.root}`]: {
              bottom: { md: -40 },
              position: { md: 'absolute' },
            },
          }}
        />

        <Box
          sx={{
            gap: 2,
            width: 1,
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <TextField
            fullWidth
            value={currentFilters.name}
            onChange={handleFilterName}
            placeholder="Buscar miembro o numero de recibo..."
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />

          <IconButton onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </Box>
      </Box>

      {renderMenuActions()}
    </>
  );
}
