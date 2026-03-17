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
import { useTheme, useMediaQuery } from '@mui/material';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';
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

  const handleFilternationalEstructure = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;

      onResetPage();
      // updateFilters({ nationalEstructure: newValue });
      updateFilters({
        nationalEstructure: newValue, status: 'all',
      });
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
                  key: 'nationalEstructure',
                  label: 'Estructura',
                  value: currentFilters.nationalEstructure,
                  onChange: handleFilternationalEstructure,
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

        {/* Filtro posición */}
        {!isMobile && (
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Posición</InputLabel>
            <Select
              multiple
              value={currentFilters.nationalXMemberPosition}
              onChange={handleFilternationalXMemberPosition}
              label="Posición"
              renderValue={(selected) =>
                options.nationalXMemberPosition
                  .filter((opt) => selected.includes(opt.value))
                  .map((opt) => opt.label)
                  .join(', ')
              }
            >
              {options.nationalXMemberPosition.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox
                    checked={currentFilters.nationalXMemberPosition.includes(option.value)}
                  />
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Filtro estructura */}
        {!isMobile && (
          <FormControl sx={{ minWidth: 220 }}>
            <InputLabel>Estructura</InputLabel>
            <Select
              multiple
              value={currentFilters.nationalEstructure}
              onChange={handleFilternationalEstructure}
              label="Estructura"
              renderValue={(selected) =>
                options.nationalEstructure
                  .filter((opt) => selected.includes(opt.value))
                  .map((opt) => opt.label)
                  .join(', ')
              }
            >
              {options.nationalEstructure.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox
                    checked={currentFilters.nationalEstructure.includes(option.value)}
                  />
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* 🖥 Desktop */}
        {!isMobile && (
          <>
            <ViewModeToggle
              value={displayMode}
              onChange={setDisplayMode}
              storageKey="global-display-mode"
            />
          </>
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
