import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Autocomplete from '@mui/material/Autocomplete';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { printTablePdf, downloadTablePdf } from 'src/utils/download-table-pdf';
import { getCell, formatExcelDate, uploadExcelRows } from 'src/utils/excel-upload';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { ExcelUploadResultDialog } from 'src/components/excel-upload-result-dialog';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

// ----------------------------------------------------------------------

const getFilterOptionValue = (option) => option?.value ?? option;

const getFilterOptionLabel = (option) =>
  String(option?.label ?? getFilterOptionValue(option) ?? '');

const getFilterAutocompleteValue = (selectedValues = [], items = []) =>
  selectedValues.map((value) => {
    const found = items.find((item) => String(getFilterOptionValue(item)) === String(value));

    return found || { value, label: String(value) };
  });

export function DestTableToolbar({
  filters,
  options,
  onResetPage,
  displayMode,
  setDisplayMode,
  rows = [],
}) {
  const menuActions = usePopover();
  const uploadInputRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [uploadResult, setUploadResult] = useState(null);

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterSectionalFullName = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({ sectionalName: newValue });
    },
    [onResetPage, updateFilters]
  );

  const renderFilterAutocomplete = (key, label, items, value, onChange) => (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={items || []}
      value={getFilterAutocompleteValue(value, items || [])}
      isOptionEqualToValue={(option, selectedOption) =>
        String(getFilterOptionValue(option)) === String(getFilterOptionValue(selectedOption))
      }
      getOptionLabel={getFilterOptionLabel}
      onChange={(event, selectedOptions) =>
        onChange({
          ...event,
          target: {
            value: selectedOptions.map(getFilterOptionValue),
          },
        })
      }
      renderOption={(props, option, { selected }) => {
        const { key: optionKey, ...optionProps } = props;

        return (
          <li key={`${key}-${getFilterOptionValue(option)}-${optionKey}`} {...optionProps}>
            <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
            {getFilterOptionLabel(option)}
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label={label} />}
      sx={{ flexGrow: 1, width: { md: 200 } }}
      slotProps={{
        paper: {
          sx: { maxHeight: 250 },
        },
      }}
    />
  );

  const pdfColumns = [
    { label: 'ID', value: (row) => row.id || row.idDestacamento },
    { label: 'Destacamento', value: (row) => row.destName || row.name || row.nombre },
    { label: 'Número', value: (row) => row.destNumber || row.numero },
    { label: 'Sección', value: (row) => row.sectionalName },
    { label: 'Iglesia', value: (row) => row.churchName },
    { label: 'Miembros', value: (row) => row.memberCount },
  ];

  const handleDownloadPdf = async () => {
    await downloadTablePdf({
      title: 'Lista de destacamentos',
      fileName: 'lista-destacamentos.pdf',
      rows,
      columns: pdfColumns,
    });
    menuActions.onClose();
  };

  const handlePrint = async () => {
    await printTablePdf({
      title: 'Lista de destacamentos',
      rows,
      columns: pdfColumns,
    });
    menuActions.onClose();
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const result = await uploadExcelRows({
      file,
      processRow: async (row) => {
        const nombre = getCell(row, ['nombre', 'Nombre', 'destacamento', 'Destacamento']);
        const idIglesia = Number(getCell(row, ['idIglesia', 'iglesiaId', 'ID Iglesia']));

        if (!nombre) throw new Error('La columna nombre es requerida.');
        if (!idIglesia) throw new Error('La columna idIglesia es requerida.');

        const res = await fetch('/api/dest/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            idIglesia,
            numero: getCell(row, ['numero', 'Número', 'destNumber']),
            correo: getCell(row, ['correo', 'Correo']),
            telefono: getCell(row, ['telefono', 'Teléfono', 'Telefono']),
            direccion: getCell(row, ['direccion', 'Dirección', 'Direccion']),
            concilio: getCell(row, ['concilio', 'Concilio']),
            registradoOfnc: getCell(row, ['registradoOfnc']) || true,
            rritrackActivo: getCell(row, ['rritrackActivo']) || false,
            diaReunion: getCell(row, ['diaReunion', 'Día reunión']),
            horaReunion: getCell(row, ['horaReunion', 'Hora reunión']),
            fechaInicio: formatExcelDate(getCell(row, ['fechaInicio', 'Fecha inicio'])),
          }),
        });

        if (!res.ok) throw new Error(await res.text());
      },
    });

    setUploadResult(result);
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
        {/* 🔥 SOLO EN MOBILE → opciones de vista */}
        {isMobile && [
          <MenuItem
            key="panel"
            selected={displayMode === 'panel'}
            onClick={() => {
              setDisplayMode('panel');
              localStorage.setItem('global-display-mode', 'panel');
              menuActions.onClose();
            }}
          >
            <Iconify icon="solar:list-bold" />
            Panel
          </MenuItem>,

          <MenuItem
            key="grid"
            selected={displayMode === 'grid'}
            onClick={() => {
              setDisplayMode('grid');
              localStorage.setItem('global-display-mode', 'grid');
              menuActions.onClose();
            }}
          >
            <Iconify icon="mingcute:dot-grid-fill" />
            Grid
          </MenuItem>,
        ]}

        <MenuItem onClick={handlePrint}>
          <Iconify icon="solar:printer-minimalistic-bold" />
          Imprimir
        </MenuItem>

        <MenuItem onClick={handleDownloadPdf}>
          <Iconify icon="solar:import-bold" />
          Descargar
        </MenuItem>

        <MenuItem onClick={() => uploadInputRef.current?.click()}>
          <Iconify icon="solar:export-bold" />
          Subir
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Box
        sx={{
          p: 2.5,
          gap: { xs: 0, md: 2 },
          display: 'flex',
          pr: { xs: 2.5, md: 1 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-end', md: 'center' },
        }}
      >
        {!isMobile && (
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
              placeholder="Buscar Destacamento o Coordinador..."
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
          </Box>
        )}

        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: { xs: '100%', md: 'auto' },
            }}
          >
            {renderFilterAutocomplete(
              'sectionalName',
              'Sección',
              options.sectionalName,
              currentFilters.sectionalName,
              handleFilterSectionalFullName
            )}
          </Box>
        )}

        {isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
            }}
          >
            <TextField
              value={currentFilters.name}
              onChange={handleFilterName}
              placeholder="Buscar Destacamento o Coordinador..."
              sx={{
                flex: 1,
                minWidth: 0,
              }}
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

            <TableToolbarMobileFilter
              hasActiveFilters={currentFilters.sectionalName.length}
              filtersConfig={[
                {
                  key: 'sectionalName',
                  label: 'Sección',
                  value: currentFilters.sectionalName,
                  onChange: handleFilterSectionalFullName,
                  options: options.sectionalName,
                },
              ]}
            />

            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}

        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 'auto',
            }}
          >
            <ViewModeToggle
              value={displayMode}
              onChange={setDisplayMode}
              storageKey="global-display-mode"
            />

            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}
      </Box>

      {renderMenuActions()}
      <input
        ref={uploadInputRef}
        hidden
        type="file"
        accept=".xlsx,.xls"
        onChange={handleUploadFile}
      />
      <ExcelUploadResultDialog
        open={!!uploadResult}
        result={uploadResult}
        logFileName="log-subida-destacamentos.txt"
        onClose={() => setUploadResult(null)}
      />
    </>
  );
}
