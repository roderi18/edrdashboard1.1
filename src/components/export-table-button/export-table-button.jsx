'use client';

import { useState, useCallback } from 'react';

import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';

import { downloadTablePdf } from 'src/utils/download-table-pdf';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const getExportFileName = (prefix = 'exportacion', extension = 'csv') => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return `${prefix}-${stamp}.${extension}`;
};

const downloadBlob = ({ blob, fileName }) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const escapeCsvValue = (value) => {
  const text = value === null || value === undefined ? '' : String(value);

  return `"${text.replace(/"/g, '""')}"`;
};

const getColumnValue = (column, row) =>
  typeof column.value === 'function' ? column.value(row) : row?.[column.value || column.id];

const getExportRows = (rows = [], columns = []) =>
  rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.label, getColumnValue(column, row)]))
  );

const downloadCsv = ({ rows = [], columns = [], fileName }) => {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCsvValue(getColumnValue(column, row))).join(','))
    .join('\n');
  const csv = `\uFEFF${header}\n${body}`;

  downloadBlob({
    blob: new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    fileName,
  });
};

const downloadExcel = async ({ rows = [], columns = [], fileName }) => {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(getExportRows(rows, columns));
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
  XLSX.writeFile(workbook, fileName);
};

export function ExportTableButton({
  rows = [],
  columns = [],
  pdfColumns,
  // Documento propio para el PDF, cuando la tabla generica no sirve: la lista de
  // precios de la tienda sale con la forma del documento oficial. Recibe las
  // filas y devuelve el elemento de `@react-pdf`.
  renderPdfDocument = null,
  // Lo mismo para el Excel: recibe las filas y devuelve el Blob del .xlsx ya
  // armado. Sin el, se escribe la hoja simple de siempre.
  buildExcelBlob = null,
  title = 'Exportación',
  fileNamePrefix = 'exportacion',
  disabled = false,
  buttonLabel = 'Exportar',
  buttonProps,
  trigger = 'button',
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const open = Boolean(anchorEl);
  const currentPdfColumns = pdfColumns || columns;
  const isDisabled = disabled || exporting || !rows.length || !columns.length;

  const handleClose = useCallback(() => {
    if (!exporting) {
      setAnchorEl(null);
    }
  }, [exporting]);

  const handleExport = useCallback(
    async (format) => {
      if (!rows.length) {
        toast.error('No hay datos para exportar.');
        return;
      }

      setExporting(true);

      try {
        if (format === 'csv') {
          downloadCsv({
            rows,
            columns,
            fileName: getExportFileName(fileNamePrefix, 'csv'),
          });
        }

        if (format === 'excel') {
          if (buildExcelBlob) {
            downloadBlob({
              blob: await buildExcelBlob(rows),
              fileName: getExportFileName(fileNamePrefix, 'xlsx'),
            });
          } else {
            await downloadExcel({
              rows,
              columns,
              fileName: getExportFileName(fileNamePrefix, 'xlsx'),
            });
          }
        }

        if (format === 'pdf') {
          await downloadTablePdf({
            title,
            rows,
            columns: currentPdfColumns,
            documento: renderPdfDocument ? renderPdfDocument(rows) : null,
            fileName: getExportFileName(fileNamePrefix, 'pdf'),
          });
        }

        toast.success('Datos exportados correctamente.');
        setAnchorEl(null);
      } catch (error) {
        console.error(error);
        toast.error(error.message || 'No se pudieron exportar los datos.');
      } finally {
        setExporting(false);
      }
    },
    [buildExcelBlob, columns, currentPdfColumns, fileNamePrefix, renderPdfDocument, rows, title]
  );

  return (
    <>
      {trigger === 'menuItem' ? (
        <MenuItem disabled={isDisabled} onClick={(event) => setAnchorEl(event.currentTarget)}>
          <Iconify icon="solar:export-bold" />
          {buttonLabel}
        </MenuItem>
      ) : (
        <Button
          color="inherit"
          variant="outlined"
          disabled={isDisabled}
          startIcon={<Iconify icon="solar:download-minimalistic-bold" />}
          endIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          {...buttonProps}
        >
          {buttonLabel}
        </Button>
      )}

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        // El desplegable, EXACTAMENTE del ancho del boton que lo abre: colgaba
        // una lista de otro ancho y las dos piezas no se leian como una sola.
        //
        // Sin suelo de `minWidth`: los 120px que habia aqui eran mas de lo que
        // mide el boton pequeño, asi que la lista sobresalia por la izquierda —el
        // borde derecho si coincidia, porque es por donde se ancla—.
        //
        // Los 96 de ahora son otra cosa: el minimo en el que "PDF" y "Excel"
        // siguen siendo legibles. No lo alcanza ningun boton con palabra —el
        // pequeño mide ~115— y solo entra cuando el boton es un icono a secas,
        // donde copiar su ancho dejaba una lista de 40px.
        slotProps={{
          paper: {
            sx: {
              width: Math.max(anchorEl?.offsetWidth ?? 0, 96),
              minWidth: Math.max(anchorEl?.offsetWidth ?? 0, 96),
            },
          },
        }}
      >
        <MenuItem disabled={exporting} onClick={() => handleExport('pdf')}>
          <Iconify icon="solar:file-text-bold" sx={{ mr: 1 }} />
          PDF
        </MenuItem>
        <MenuItem disabled={exporting} onClick={() => handleExport('excel')}>
          <Iconify icon="solar:document-bold" sx={{ mr: 1 }} />
          Excel
        </MenuItem>
        <MenuItem disabled={exporting} onClick={() => handleExport('csv')}>
          <Iconify icon="solar:document-add-bold" sx={{ mr: 1 }} />
          CSV
        </MenuItem>
      </Menu>
    </>
  );
}
