import { useCallback } from 'react';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import { ViewModeToggle } from 'src/components/view-mode-toggle/ViewModeToggle';

// ----------------------------------------------------------------------

export function AdminTableToolbar({ filters, onResetPage, displayMode, setDisplayMode }) {
  const { state: currentFilters, setState: updateFilters } = filters;

  const handleFilterName = useCallback(
    (event) => {
      onResetPage();
      updateFilters({ name: event.target.value });
    },
    [onResetPage, updateFilters]
  );

  return (
    <Box
      sx={{
        gap: 2,
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        flexDirection: { xs: 'column', md: 'row' },
      }}
    >
      <TextField
        fullWidth
        value={currentFilters.name}
        onChange={handleFilterName}
        placeholder="Buscar nombre"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{ maxWidth: { md: 360 } }}
      />

      <Box sx={{ flexGrow: 1 }} />

      <ViewModeToggle
        value={displayMode}
        onChange={setDisplayMode}
        storageKey="admin-display-mode"
      />

      <IconButton>
        <Iconify icon="eva:more-vertical-fill" />
      </IconButton>
    </Box>
  );
}
