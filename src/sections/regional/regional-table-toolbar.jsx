import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { printTablePdf } from 'src/utils/download-table-pdf';
import { getCell, uploadExcelRows } from 'src/utils/excel-upload';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ExportTableButton } from 'src/components/export-table-button';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { ExcelUploadResultDialog } from 'src/components/excel-upload-result-dialog';
// ----------------------------------------------------------------------

export function RegionalTableToolbar({ filters, options, onResetPage, displayMode, setDisplayMode, rows = [] }) {
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

  const pdfColumns = [
    { label: 'ID', value: (row) => row.id || row.idRegion },
    { label: 'Región', value: (row) => row.regionalName || row.name || row.nombre },
    { label: 'Director', value: (row) => row.directorName || row.director || 'Desconocido' },
    { label: 'Secciones', value: (row) => row.regionalXSectionalCount || row.sectionalCount },
    { label: 'Destacamentos', value: (row) => row.regionalXSectionalXDestCount || row.destCount },
    { label: 'Miembros', value: (row) => row.regionalXSectionalMemberCount || row.memberCount },
  ];

  const handlePrint = async () => {
    await printTablePdf({
      title: 'Lista de regiones',
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
        const nombre = getCell(row, ['nombre', 'Nombre', 'region', 'Región', 'Region']);

        if (!nombre) throw new Error('La columna nombre es requerida.');

        const res = await fetch('/api/regional/post/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idRegion: 0,
            nombre,
            idPais: Number(getCell(row, ['idPais', 'paisId', 'País ID'])) || 1,
            idCargoInstitucional: Number(getCell(row, ['idCargoInstitucional'])) || null,
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

        {/* 🔥 SOLO MOBILE → Grid / Panel */}
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
          </MenuItem>
        ]}

        <MenuItem onClick={handlePrint}>
          <Iconify icon="solar:printer-minimalistic-bold" />
          Imprimir
        </MenuItem>

        <ExportTableButton
          rows={rows}
          columns={pdfColumns}
          title="Lista de regiones"
          fileNamePrefix="lista-regiones"
          trigger="menuItem"
        />

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
          gap: 2,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* 🔍 Search */}
        <TextField
          fullWidth
          value={currentFilters.name}
          onChange={handleFilterName}
          placeholder="Buscar Región o Director..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />

        {/* 🖥 Desktop */}
        {!isMobile && (
          <>
            <ViewModeToggle
              value={displayMode}
              onChange={setDisplayMode}
              storageKey="global-display-mode"
            />

            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </>
        )}

        {/* 📱 Mobile */}
        {isMobile && (
          <IconButton onClick={menuActions.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
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
        logFileName="log-subida-regiones.txt"
        onClose={() => setUploadResult(null)}
      />
    </>
  );
}
