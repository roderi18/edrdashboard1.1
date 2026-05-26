import { useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { formHelperTextClasses } from '@mui/material/FormHelperText';

import { fDateTime } from 'src/utils/format-time';
import { fDopCurrency } from 'src/utils/format-number';
import { printTablePdf } from 'src/utils/download-table-pdf';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ExportTableButton } from 'src/components/export-table-button';

// ----------------------------------------------------------------------

const ORDER_EXPORT_COLUMNS = [
  { label: 'Pedido', value: (row) => row.orderNumber || row.id },
  { label: 'Miembro', value: (row) => row.customer?.name || '' },
  { label: 'Código miembro', value: (row) => row.customer?.codigoMiembro || row.customer?.memberId || '' },
  { label: 'Fecha', value: (row) => fDateTime(row.createdAt) },
  { label: 'Cantidad', value: (row) => row.totalQuantity },
  { label: 'Subtotal', value: (row) => fDopCurrency(row.subtotal) },
  { label: 'Estado', value: (row) => row.status },
  { label: 'Productos', value: (row) => (row.items || []).map((item) => item.name).join(', ') },
];

export function OrderTableToolbar({ filters, onResetPage, dateError, rows = [] }) {
  const menuActions = usePopover();

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
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
      title: 'Lista de pedidos',
      rows,
      columns: ORDER_EXPORT_COLUMNS.slice(0, 7),
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
          columns={ORDER_EXPORT_COLUMNS}
          pdfColumns={ORDER_EXPORT_COLUMNS.slice(0, 7)}
          title="Lista de pedidos"
          fileNamePrefix="lista-pedidos"
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
        <DatePicker
          label="Fecha inicial"
          value={currentFilters.startDate}
          onChange={handleFilterStartDate}
          sx={{ maxWidth: { md: 200 } }}
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
            maxWidth: { md: 200 },
            [`& .${formHelperTextClasses.root}`]: {
              position: { md: 'absolute' },
              bottom: { md: -40 },
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
            placeholder="Buscar miembro o numero de pedido..."
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
