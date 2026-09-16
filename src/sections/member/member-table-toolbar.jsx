import { pdf } from '@react-pdf/renderer';
import { useState, useCallback } from 'react';
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

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { ExcelUploadResultDialog } from 'src/components/excel-upload-result-dialog';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

import { useAuthContext } from 'src/auth/hooks';

import { useMemberImport } from './hooks/use-member-import';
import { MemberDownloadDialog } from './member-download-dialog';
import { MemberUploadProgressDialog } from './member-upload-progress-dialog';
import {
  downloadMembersCsv,
  MembersPdfDocument,
  applyDownloadFilters,
  getFilterOptionLabel,
  getFilterOptionValue,
  DEFAULT_DOWNLOAD_FILTERS,
} from './member-toolbar-download-utils';

// ----------------------------------------------------------------------

export function MemberTableToolbar({
  filters,
  onResetPage,
  displayMode,
  setDisplayMode,
  options,
  members = [],
  canManageMembers = true,
  showScopeFilters = true,
  onMembersUploaded,
}) {
  const { user } = useAuthContext();
  const menuActions = usePopover();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadFilters, setDownloadFilters] = useState(DEFAULT_DOWNLOAD_FILTERS);
  const {
    uploadInputRef,
    uploadResult,
    uploadProgress,
    templateDownloading,
    handleUploadFile,
    handleDownloadMemberTemplate,
    closeUploadResult,
  } = useMemberImport({
    user,
    onMembersUploaded,
    onCloseActions: menuActions.onClose,
  });

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );
  const handleFilterdestName = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({
        destName: newValue.map((v) => (typeof v === 'object' ? v.value : v)),
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterSectionalId = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({
        sectionalId: newValue.map((v) => (typeof v === 'object' ? v.value : v)),
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterMemberPosition = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({ memberPosition: newValue });
    },
    [onResetPage, updateFilters]
  );

  const downloadMembersPdf = async (membersToDownload) => {
    const blob = await pdf(<MembersPdfDocument members={membersToDownload} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'lista-miembros.pdf';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenDownloadDialog = () => {
    menuActions.onClose();
    setDownloadFilters(DEFAULT_DOWNLOAD_FILTERS);
    setDownloadDialogOpen(true);
  };

  const handleDownloadMembers = async () => {
    const membersToDownload = applyDownloadFilters(members, downloadFilters);

    if (downloadFilters.format === 'csv') {
      downloadMembersCsv(membersToDownload);
    } else {
      await downloadMembersPdf(membersToDownload);
    }

    setDownloadDialogOpen(false);
  };

  const renderFilterSelect = (key, label, items, value, onChange) => (
    <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
      <InputLabel htmlFor={`filter-${key}-select`}>{label}</InputLabel>
      <Select
        multiple
        label={label}
        value={value}
        onChange={onChange}
        renderValue={(selected) =>
          selected
            .map((selectedValue) => {
              const found = (items || []).find(
                (item) => String(getFilterOptionValue(item)) === String(selectedValue)
              );

              return found ? getFilterOptionLabel(found) : selectedValue;
            })
            .join(', ')
        }
        inputProps={{ id: `filter-${key}-select` }}
        MenuProps={{
          slotProps: { paper: { sx: { maxHeight: 250 } } },
        }}
      >
        {(items || []).map((option, index) => {
          const optionValue = getFilterOptionValue(option);

          return (
            <MenuItem key={`${key}-${optionValue}-${index}`} value={optionValue}>
              <Checkbox size="small" checked={value.includes(optionValue)} />
              {getFilterOptionLabel(option)}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );

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
              menuActions.onClose();
            }}
          >
            <Iconify icon="mingcute:dot-grid-fill" />
            Grid
          </MenuItem>,
        ]}

        <MenuItem onClick={handleOpenDownloadDialog}>
          <Iconify icon="solar:import-bold" />
          Descargar
        </MenuItem>

        <MenuItem disabled={templateDownloading} onClick={handleDownloadMemberTemplate}>
          <Iconify icon="solar:download-minimalistic-bold" />
          {templateDownloading ? 'Preparando plantilla...' : 'Descargar plantilla miembros'}
        </MenuItem>

        {canManageMembers && (
          <MenuItem disabled={uploadProgress.open} onClick={() => uploadInputRef.current?.click()}>
            <Iconify icon="solar:export-bold" />
            Subir
          </MenuItem>
        )}
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
        <Box
          sx={{
            gap: 2,
            width: 1,
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {!isMobile && (
            <TextField
              fullWidth
              value={currentFilters.name}
              onChange={handleFilterName}
              placeholder="Buscar nombre..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />
          )}
        </Box>

        {/* boton de filtro para desktop */}
        {!isMobile && (
          <>
            {showScopeFilters &&
              renderFilterSelect(
                'destName',
                'Destacamento',
                options.destName,
                currentFilters.destName,
                handleFilterdestName
              )}

            {renderFilterSelect(
              'memberPosition',
              'Posición',
              options.memberPosition,
              currentFilters.memberPosition,
              handleFilterMemberPosition
            )}

            {showScopeFilters &&
              renderFilterSelect(
                'sectionalId',
                'Sección',
                options.sectionalId,
                currentFilters.sectionalId,
                handleFilterSectionalId
              )}
          </>
        )}

        {/* boton de filtro para moviles */}
        {/* Mobile Filter + View Toggle alineados */}
        {isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
            }}
          >
            {/* 🔍 Search */}
            <TextField
              value={currentFilters.name}
              onChange={handleFilterName}
              placeholder="Buscar nombre..."
              sx={{
                flex: 1, // 🔥 ocupa TODO el espacio sobrante
                minWidth: 0, // 🔥 evita que rompa el flexbox
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* 🔽 Filter */}
            <TableToolbarMobileFilter
              hasActiveFilters={
                (showScopeFilters && currentFilters.destName.length) ||
                currentFilters.memberPosition.length ||
                (showScopeFilters && currentFilters.sectionalId.length)
              }
              filtersConfig={[
                ...(showScopeFilters
                  ? [
                      {
                        key: 'destName',
                        label: 'Destacamento',
                        value: currentFilters.destName,
                        onChange: handleFilterdestName,
                        options: options.destName,
                      },
                    ]
                  : []),
                {
                  key: 'memberPosition',
                  label: 'Posición',
                  value: currentFilters.memberPosition,
                  onChange: handleFilterMemberPosition,
                  options: options.memberPosition,
                },
                ...(showScopeFilters
                  ? [
                      {
                        key: 'sectionalId',
                        label: 'Sección',
                        value: currentFilters.sectionalId,
                        onChange: handleFilterSectionalId,
                        options: options.sectionalId,
                      },
                    ]
                  : []),
              ]}
            />

            {/* ⋮ More */}
            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}

        {/* 🔄 View Mode + ⋮ More para desktop */}
        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 'auto', // 🔥 los empuja a la derecha
            }}
          >
            {!isMobile && (
              <ViewModeToggle
                value={displayMode}
                onChange={setDisplayMode}
                storageKey="global-display-mode"
              />
            )}

            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}
      </Box>

      {renderMenuActions()}
      <MemberDownloadDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        filters={downloadFilters}
        setFilters={setDownloadFilters}
        options={options}
        members={members}
        onDownload={handleDownloadMembers}
      />
      <MemberUploadProgressDialog progress={uploadProgress} />
      <input
        ref={uploadInputRef}
        hidden
        type="file"
        accept=".csv,.txt,.tsv,.xlsx,.xls"
        onChange={handleUploadFile}
      />
      <ExcelUploadResultDialog
        open={!!uploadResult}
        result={uploadResult}
        logFileName="log-subida-miembros.txt"
        onClose={closeUploadResult}
      />
    </>
  );
}

