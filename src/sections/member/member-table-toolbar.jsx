import { useCallback } from 'react';
import { getDests } from 'src/services/dest-service';
import { getSectionals } from 'src/services/sectional-service';
import { usePopover } from 'minimal-shared/hooks';
import { resolveById } from 'src/utils/resolve-display-name';

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

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';
import { useTheme, useMediaQuery } from '@mui/material';
import { TableToolbarMobileFilter } from 'src/components/mobile-filter/table-toolbar-mobile-filter';// ----------------------------------------------------------------------

export function MemberTableToolbar({ filters, options, onResetPage, displayMode, setDisplayMode }) {
  const menuActions = usePopover();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dests = getDests();
  const sectionals = getSectionals();

  const filtersPopover = usePopover();

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
        destName: newValue.map((v) =>
          typeof v === 'object' ? v.value : v
        ),
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterMemberDivision = useCallback(
    (event) => {
      onResetPage();
      updateFilters({
        memberDivision: event.target.value,
      });
    },
    [onResetPage, updateFilters]
  );

  const handleFilterSectionalId = useCallback(
    (event) => {
      const newValue =
        typeof event.target.value === 'string'
          ? event.target.value.split(',')
          : event.target.value;

      onResetPage();
      updateFilters({
        sectionalId: newValue.map((v) =>
          typeof v === 'object' ? v.value : v
        ),
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
          </MenuItem>
        ]}

        {/* Acciones normales */}
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
            {/* Destacamento */}
            <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
              <InputLabel htmlFor="filter-destName-select">
                Destacamento
              </InputLabel>

              <Select
                multiple
                label="Destacamento"
                value={currentFilters.destName}
                onChange={handleFilterdestName}
                renderValue={(selected) =>
                  selected
                    .map((id) => dests.find((d) => d.id === id)?.name)
                    .join(', ')
                }
                inputProps={{ id: 'filter-destName-select' }}
                MenuProps={{
                  slotProps: { paper: { sx: { maxHeight: 250 } } },
                }}
              >
                {(options.destName || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox checked={currentFilters.destName.includes(option.value)} />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Posición */}
            <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
              <InputLabel htmlFor="filter-memberPosition-select">
                Posición
              </InputLabel>

              <Select
                multiple
                label="Posición"
                value={currentFilters.memberPosition}
                onChange={handleFilterMemberPosition}
                renderValue={(selected) =>
                  selected
                    .map(
                      (value) =>
                        options.memberPosition?.find((opt) => opt.value === value)?.label || value
                    )
                    .join(', ')
                }
                inputProps={{ id: 'filter-memberPosition-select' }}
                MenuProps={{
                  slotProps: { paper: { sx: { maxHeight: 250 } } },
                }}
              >
                {(options.memberPosition || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox
                      disableRipple
                      size="small"
                      checked={currentFilters.memberPosition.includes(option.value)}
                    />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Sección */}
            <FormControl sx={{ flexShrink: 0, width: { md: 180 } }}>
              <InputLabel htmlFor="filter-sectionalId-select">
                Sección
              </InputLabel>

              <Select
                multiple
                label="Sección"
                value={currentFilters.sectionalId}
                onChange={handleFilterSectionalId}
               renderValue={(selected) =>
  selected
    .map((id) => {
      const found = sectionals.find((s) => s.id?.toString() === id?.toString());
      return found?.name || id;
    })
    .join(', ')
}
                inputProps={{ id: 'filter-sectionalId-select' }}
                MenuProps={{
                  slotProps: { paper: { sx: { maxHeight: 250 } } },
                }}
              >
                {(options.sectionalId || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox
                      size="small"
                      checked={currentFilters.sectionalId.includes(option.value)}
                    />
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
                flex: 1,        // 🔥 ocupa TODO el espacio sobrante
                minWidth: 0,    // 🔥 evita que rompa el flexbox
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
                currentFilters.destName.length ||
                currentFilters.memberPosition.length ||
                currentFilters.sectionalId.length
              }
              filtersConfig={[
                {
                  key: 'destName',
                  label: 'Destacamento',
                  value: currentFilters.destName,
                  onChange: handleFilterdestName,
                  options: options.destName,
                  renderValue: (selected) =>
                    selected
                      .map((id) => dests.find((d) => d.id === id)?.name)
                      .join(', '),
                },
                {
                  key: 'memberPosition',
                  label: 'Posición',
                  value: currentFilters.memberPosition,
                  onChange: handleFilterMemberPosition,
                  options: options.memberPosition,
                  renderValue: (selected) => selected.join(', '),
                  // renderValue: (selected) =>
                  //   selected
                  //     .map( ------en caso que no funcione el de arriba
                  //       (value) =>
                  //         options.memberPosition?.find((opt) => opt.value === value)?.label || value
                  //     )
                  //     .join(', '),
                },
                {
                  key: 'sectionalId',
                  label: 'Sección',
                  value: currentFilters.sectionalId,
                  onChange: handleFilterSectionalId,
                  options: options.sectionalId,
                  renderValue: (selected) =>
                    selected
                      .map((id) => sectionals.find((s) => s.id === id)?.name)
                      .join(', '),
                },
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
      </Box >

      {renderMenuActions()}
    </>
  );
}
