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
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { printTablePdf, downloadTablePdf } from 'src/utils/download-table-pdf';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';

// ----------------------------------------------------------------------

export function DestTableToolbar({ filters, options, onResetPage, displayMode, setDisplayMode, rows = [] }) {
  const menuActions = usePopover();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

  const getSectionalNameById = (id) =>
    options.sectionalName?.find((opt) => opt.value === id)?.label || id;

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

        <MenuItem onClick={() => menuActions.onClose()}>
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
          pr: { xs: 2.5, md: 1 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' }

        }}
      >


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

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: { xs: '100%', md: 'auto' }
          }}
        >
          <FormControl sx={{ flexGrow: 1, width: { md: 200 } }}>
            <InputLabel htmlFor="filter-sectionalName-select">Sección</InputLabel>
            <Select
              multiple
              label="Sección"
              value={currentFilters.sectionalName}
              onChange={handleFilterSectionalFullName}
              renderValue={(selected) =>
                selected.map((id) => getSectionalNameById(id)).join(', ')
              }
              inputProps={{ id: 'filter-sectionalName-select' }}
              MenuProps={{
                slotProps: { paper: { sx: { maxHeight: 250 } } },
              }}
            >
              {(options.sectionalName || []).map((option, index) => (
                <MenuItem key={`${option.value}-${index}`} value={option.value}>
                  <Checkbox
                    disableRipple
                    size="small"
                    checked={currentFilters.sectionalName.includes(option.value)}
                  />
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {isMobile && (
            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          )}
        </Box>

        {/* View Mode + ⋮ More solo desktop */}
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
    </>
  );
}
