import { useCallback } from 'react';
import { usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import { useTheme, useMediaQuery } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';

import { FiltroBuscable } from './filtro-buscable';
// ----------------------------------------------------------------------

export function NationalTableToolbar({ filters, options, onResetPage, displayMode, setDisplayMode }) {
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

  const handleFilternationalXMemberPosition = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({ nationalXMemberPosition: newValue });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterOrganizationalLevel = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({
        nationalOrganizationalLevel: newValue,
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterEstructure = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      updateFilters({ nationalEstructure: newValue });
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

        {/* 🔥 SOLO MOBILE */}
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

        <MenuItem onClick={() => menuActions.onClose()}>
          <Iconify icon="solar:printer-minimalistic-bold" />
          Print
        </MenuItem>

        <MenuItem onClick={() => menuActions.onClose()}>
          <Iconify icon="solar:import-bold" />
          Import
        </MenuItem>

        <MenuItem onClick={() => menuActions.onClose()}>
          <Iconify icon="solar:export-bold" />
          Export
        </MenuItem>

      </MenuList>
    </CustomPopover>
  );

  return (
    <>
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          flexDirection: {
            xs: 'column',
            md: 'row',
          },
          alignItems: {
            xs: 'stretch',
            md: 'center',
          },
          gap: 2,
        }}
      >
        {/* 🔍 Search */}
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
          />)}

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
              placeholder="Buscar nombre..."
              sx={{
                flex: 1,
                minWidth: 0,
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TableToolbarMobileFilter
              hasActiveFilters={
                currentFilters.nationalXMemberPosition.length ||
                currentFilters.nationalOrganizationalLevel.length ||
                currentFilters.nationalEstructure.length
              }
              filtersConfig={[
                {
                  key: 'nationalXMemberPosition',
                  label: 'Posición',
                  value: currentFilters.nationalXMemberPosition,
                  onChange: handleFilternationalXMemberPosition,
                  options: options.nationalXMemberPosition,
                  renderValue: (selected) => selected.join(', '),
                },
                {
                  key: 'nationalOrganizationalLevel',
                  label: 'Nivel organizacional',
                  value: currentFilters.nationalOrganizationalLevel,
                  onChange: handleFilterOrganizationalLevel,
                  options: options.nationalOrganizationalLevel,
                  renderValue: (selected) => selected.join(', '),
                },
                {
                  key: 'nationalEstructure',
                  label: 'Estructura',
                  value: currentFilters.nationalEstructure,
                  onChange: handleFilterEstructure,
                  options: options.nationalEstructure,
                  renderValue: (selected) => selected.join(', '),
                },
              ]}
            />

            <IconButton onClick={menuActions.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Box>
        )}

        {/* Filtros con buscador (ver `FiltroBuscable`): posición, nivel y estructura. */}
        {!isMobile && (
          <FiltroBuscable
            multiple
            label="Posición"
            options={options.nationalXMemberPosition}
            value={currentFilters.nationalXMemberPosition}
            onChange={(valores) => {
              onResetPage();
              updateFilters({ nationalXMemberPosition: valores });
            }}
            sx={{ minWidth: 220, flexShrink: 0 }}
          />
        )}
        {!isMobile && (
          <FiltroBuscable
            multiple
            label="Nivel organizacional"
            options={options.nationalOrganizationalLevel}
            value={currentFilters.nationalOrganizationalLevel}
            onChange={(valores) => {
              onResetPage();
              updateFilters({ nationalOrganizationalLevel: valores });
            }}
            sx={{ minWidth: 220, flexShrink: 0 }}
          />
        )}
        {!isMobile && (
          <FiltroBuscable
            multiple
            label="Estructura"
            options={options.nationalEstructure}
            value={currentFilters.nationalEstructure}
            onChange={(valores) => {
              onResetPage();
              updateFilters({ nationalEstructure: valores });
            }}
            sx={{ minWidth: 220, flexShrink: 0 }}
          />
        )}

        {/* 🖥 Desktop */}
        {!isMobile && (
          <ViewModeToggle
              value={displayMode}
              onChange={setDisplayMode}
              storageKey="global-display-mode"
            />
        )}
        {!isMobile && (
          <IconButton
            onClick={menuActions.onOpen}
            sx={{
              ml: { md: 'auto' },
              alignSelf: { xs: 'flex-end', md: 'center' },
            }}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        )}
      </Box>

      {renderMenuActions()}
    </>
  );
}
