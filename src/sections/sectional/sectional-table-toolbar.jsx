import { usePopover } from 'minimal-shared/hooks';
import { useRef, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { getCell, uploadExcelRows } from 'src/utils/excel-upload';
import { printTablePdf, downloadTablePdf } from 'src/utils/download-table-pdf';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { ExcelUploadResultDialog } from 'src/components/excel-upload-result-dialog';

// ----------------------------------------------------------------------

export function SectionalTableToolbar({ filters, options, onResetPage, displayMode, setDisplayMode, rows = [] }) {
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
    { label: 'ID', value: (row) => row.id || row.idSeccion },
    { label: 'Sección', value: (row) => row.sectionalName || row.name || row.nombre },
    { label: 'Director', value: (row) => row.directorName || row.director || 'Desconocido' },
    { label: 'Región', value: (row) => row.regionalName },
    { label: 'Destacamentos', value: (row) => row.sectionalDestCount || row.destCount },
    { label: 'Miembros', value: (row) => row.sectionalXDestMemberCount || row.memberCount },
  ];

  const handleDownloadPdf = async () => {
    await downloadTablePdf({
      title: 'Lista de secciones',
      fileName: 'lista-secciones.pdf',
      rows,
      columns: pdfColumns,
    });
    menuActions.onClose();
  };

  const handlePrint = async () => {
    await printTablePdf({
      title: 'Lista de secciones',
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
        const nombre = getCell(row, ['nombre', 'Nombre', 'seccion', 'Sección', 'Seccion']);
        const idRegion = Number(getCell(row, ['idRegion', 'regionId', 'ID Región', 'ID Region']));

        if (!nombre) throw new Error('La columna nombre es requerida.');
        if (!idRegion) throw new Error('La columna idRegion es requerida.');

        const res = await fetch('/api/sectional/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idSeccion: 0, nombre, idRegion }),
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
          placeholder="Buscar Sección o Director..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />

        {/* 🖥 DESKTOP */}
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

        {/* 📱 MOBILE */}
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
        logFileName="log-subida-secciones.txt"
        onClose={() => setUploadResult(null)}
      />
    </>
  );
}
