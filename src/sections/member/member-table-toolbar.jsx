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

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

export function MemberTableToolbar({ filters, options, onResetPage }) {
  const menuActions = usePopover();

  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );

  // const handleFilterMemberDivisionTab = useCallback(
  //   (event, newValue) => {
  //     table.onResetPage();
  //     updateFilters({
  //       memberDivision: newValue,
  //       status: [],
  //     });
  //   },
  //   [updateFilters, table]
  // );

  const handleFilterMemberStatus = useCallback(
    (event) => {
      onResetPage();
      updateFilters({
        status: event.target.value,
      });
    },
    [onResetPage, updateFilters]
  );


  const handleFilterMemberDivision = useCallback(
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
          gap: 2,
          display: 'flex',
          pr: { xs: 2.5, md: 1 },
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-end', md: 'center' },
        }}
      >
        <FormControl sx={{ flexShrink: 0, width: { xs: 1, md: 180 } }}>
          <InputLabel htmlFor="filter-memberPosition-select">Posición</InputLabel>
          <Select
            multiple
            label="Posición"
            value={currentFilters.memberPosition}
            // onChange={handleFilterMemberDivisionTab}
            onChange={handleFilterMemberDivision}
            renderValue={(selected) => selected.map((value) => value).join(', ')}
            inputProps={{ id: 'filter-memberPosition-select' }}
            MenuProps={{
              slotProps: { paper: { sx: { maxHeight: 240 } } },
            }}
          >
            {/* {options.memberPosition.map((option) => (
              <MenuItem key={option} value={option}>
                <Checkbox
                  disableRipple
                  size="small"
                  checked={currentFilters.memberPosition.includes(option)}
                  slotProps={{ input: { id: `${option}-checkbox` } }}
                />
                {option}
              </MenuItem>
            ))} */}
            {options.memberPosition.map((option, index) => (
              <MenuItem key={`${option}-${index}`} value={option}>
                <Checkbox
                  disableRipple
                  size="small"
                  checked={currentFilters.memberPosition.includes(option)}
                  slotProps={{ input: { id: `${option}-${index}-checkbox` } }}
                />
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* <FormControl sx={{ flexShrink: 0, width: { xs: 1, md: 180 } }}>
          <InputLabel htmlFor="filter-memberStatus-select">Estado</InputLabel>
          <Select
            label="Estado"
            value={currentFilters.status || 'all'}
            onChange={handleFilterMemberStatus}
            inputProps={{ id: 'filter-memberStatus-select' }}
          >
            <MenuItem value="all">Todos</MenuItem>

            {options.memberStatus.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl> */}
        <FormControl sx={{ flexShrink: 0, width: { xs: 1, md: 180 } }}>
          <InputLabel htmlFor="filter-memberStatus-select">Estado</InputLabel>
          <Select
            multiple
            label="Estado"
            value={currentFilters.status}
            onChange={handleFilterMemberStatus}
            renderValue={(selected) => selected.join(', ')}
            inputProps={{ id: 'filter-memberStatus-select' }}
          >
            {options.memberStatus.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Checkbox
                  disableRipple
                  size="small"
                  checked={currentFilters.status.includes(option.value)}
                />
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>


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
            placeholder="Buscar..."
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
