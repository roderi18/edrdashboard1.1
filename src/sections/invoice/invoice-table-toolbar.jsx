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

import { fDateTime } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';
import { printTablePdf } from 'src/utils/download-table-pdf';

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
  {
    label: 'Items',
    value: (row) => (row.items || []).map((item) => item.title || item.name).join(', '),
  },
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

  const handlePrint = async () => {
    await printTablePdf({
      title: 'Lista de recibos',
      rows,
      columns: INVOICE_EXPORT_COLUMNS.slice(0, 8),
    });
    menuActions.onClose();
  };

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        <MenuItem onClick={handlePrint}>
          <Iconify icon="solar:printer-minimalistic-bold" />
          Imprimir
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
      {/* LA MISMA BARRA QUE LA LISTA DE PEDIDOS.

          Una rejilla que se parte sola, y el BUSCADOR PRIMERO. Estaba al final,
          detras de los tres desplegables: es lo que se usa nada mas entrar
          —"el recibo de tal"— y habia que cruzar la fila entera para llegar,
          ademas de aprenderse un orden distinto en cada una de las dos listas,
          que son hermanas.

          Las fechas van con el calendario del proyecto y en el formato de la
          casa, como en pedidos. */}
      <Box
        sx={{
          p: 2.5,
          gap: 2,
          display: 'grid',
          alignItems: 'center',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: '1.6fr repeat(3, 1fr) auto',
          },
        }}
      >
        <TextField
          fullWidth
          size="small"
          value={currentFilters.name}
          onChange={handleFilterName}
          placeholder="Buscar miembro o número de recibo…"
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

        <FormControl fullWidth size="small">
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
          format="DD/MM/YYYY"
          value={currentFilters.startDate}
          onChange={handleFilterStartDate}
          slotProps={{ textField: { fullWidth: true, size: 'small' } }}
        />

        <DatePicker
          label="Fecha final"
          format="DD/MM/YYYY"
          value={currentFilters.endDate}
          onChange={handleFilterEndDate}
          slotProps={{
            textField: {
              fullWidth: true,
              size: 'small',
              error: dateError,
              // El aviso va en el campo que esta mal: "revisa las fechas"
              // obliga a adivinar cual de las dos.
              helperText: dateError ? 'Es anterior a la inicial' : null,
            },
          }}
        />

        <IconButton onClick={menuActions.onOpen} sx={{ justifySelf: 'end' }}>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Box>

      {renderMenuActions()}
    </>
  );
}
